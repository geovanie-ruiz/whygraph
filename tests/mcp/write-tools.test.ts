import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMcpServer } from "../../src/mcp/server.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function graphqlResponse(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("MCP write tools (strict mode)", () => {
  let client: Client;

  beforeEach(async () => {
    mockFetch.mockReset();
    process.env["WHYGRAPH_MPC_MODE"] = "strict";
    delete process.env["WHYGRAPH_PORT"];

    const mcpServer = createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({ name: "test-client", version: "1.0.0" });
    await mcpServer.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    delete process.env["WHYGRAPH_MPC_MODE"];
    await client.close();
  });

  describe("whygraph_create_decision", () => {
    it("calls createDecision mutation with correct variables", async () => {
      const created = {
        createDecision: {
          id: "wg-abc1",
          title: "Use JWT",
          status: "active",
          date: "2026-03-24",
          affects: ["node1"],
          tags: ["security"],
          context: "Need auth",
          decision: "Use JWT",
          tradeoffs: "Token size",
          alternatives: "Sessions",
          supersedes: null,
          created_at: "2026-03-24T00:00:00Z",
          updated_at: "2026-03-24T00:00:00Z",
        },
      };
      mockFetch.mockResolvedValueOnce(graphqlResponse(created));

      const result = await client.callTool({
        name: "whygraph_create_decision",
        arguments: {
          title: "Use JWT",
          date: "2026-03-24",
          affects: ["node1"],
          tags: ["security"],
          context: "Need auth",
          decision: "Use JWT",
          tradeoffs: "Token size",
          alternatives: "Sessions",
        },
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(opts.body as string);
      expect(body.query).toContain("createDecision");
      expect(body.variables.title).toBe("Use JWT");
      expect(body.variables.affects).toEqual(["node1"]);
      expect(body.variables.tags).toEqual(["security"]);

      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.id).toBe("wg-abc1");
    });

    it("passes supersedes when provided", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ createDecision: { id: "wg-abc2" } }),
      );

      await client.callTool({
        name: "whygraph_create_decision",
        arguments: {
          title: "Use JWT v2",
          date: "2026-03-24",
          affects: ["node1"],
          tags: ["security"],
          context: "Need auth v2",
          decision: "Use JWT v2",
          tradeoffs: "Token size v2",
          alternatives: "Sessions v2",
          supersedes: "wg-abc1",
        },
      });

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.variables.supersedes).toBe("wg-abc1");
    });
  });

  describe("whygraph_create_node", () => {
    it("calls createNode mutation with correct variables", async () => {
      const created = {
        createNode: {
          id: "wg-xyz1",
          label: "Feature",
          name: "Auth",
          status: "active",
          parent: null,
          refs: null,
          description: null,
          created_at: "2026-03-24T00:00:00Z",
          updated_at: "2026-03-24T00:00:00Z",
        },
      };
      mockFetch.mockResolvedValueOnce(graphqlResponse(created));

      const result = await client.callTool({
        name: "whygraph_create_node",
        arguments: {
          label: "Feature",
          name: "Auth",
        },
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(opts.body as string);
      expect(body.query).toContain("createNode");
      expect(body.variables.label).toBe("Feature");
      expect(body.variables.name).toBe("Auth");

      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.id).toBe("wg-xyz1");
    });

    it("passes optional fields when provided", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ createNode: { id: "wg-xyz2" } }),
      );

      await client.callTool({
        name: "whygraph_create_node",
        arguments: {
          label: "Component",
          name: "LoginForm",
          parent: "wg-feat1",
          refs: [{ file: "src/login.ts", symbol: "LoginForm" }],
          description: "The login form component",
        },
      });

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.variables.parent).toBe("wg-feat1");
      expect(body.variables.refs).toEqual([{ file: "src/login.ts", symbol: "LoginForm" }]);
      expect(body.variables.description).toBe("The login form component");
    });
  });
});

describe("MCP write tools not registered in default mode", () => {
  it("does not register write tools when mode is not strict", async () => {
    delete process.env["WHYGRAPH_MPC_MODE"];

    const mcpServer = createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const client = new Client({ name: "test-client", version: "1.0.0" });
    await mcpServer.connect(serverTransport);
    await client.connect(clientTransport);

    const tools = await client.listTools();
    const toolNames = tools.tools.map((t) => t.name);

    expect(toolNames).not.toContain("whygraph_create_decision");
    expect(toolNames).not.toContain("whygraph_create_node");

    // Verify read tools are still registered
    expect(toolNames).toContain("whygraph_context");

    await client.close();
  });
});
