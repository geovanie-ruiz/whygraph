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

function graphqlErrorResponse(message: string) {
  return new Response(JSON.stringify({ errors: [{ message }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("MCP server tools", () => {
  let client: Client;

  beforeEach(async () => {
    mockFetch.mockReset();
    delete process.env["WHYGRAPH_PORT"];

    const mcpServer = createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({ name: "test-client", version: "1.0.0" });
    await mcpServer.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
  });

  describe("whygraph_context", () => {
    it("calls correct GraphQL query and returns results", async () => {
      const contextResult = {
        context: {
          nodes: [{ id: "n1", label: "Feature", name: "Auth", parentChain: ["app1"] }],
          decisions: [{ id: "d1", attributes: '{"title":"Use JWT"}' }],
        },
      };
      mockFetch.mockResolvedValueOnce(graphqlResponse(contextResult));

      const result = await client.callTool({ name: "whygraph_context", arguments: { file: "src/auth.ts" } });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:4777/api/graphql");
      const body = JSON.parse(opts.body as string);
      expect(body.variables.file).toBe("src/auth.ts");
      expect(body.query).toContain("context(file: $file");

      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].type).toBe("text");
      const parsed = JSON.parse(content[0].text);
      expect(parsed.nodes).toHaveLength(1);
      expect(parsed.nodes[0].id).toBe("n1");
      expect(parsed.decisions).toHaveLength(1);
    });

    it("passes symbol parameter when provided", async () => {
      mockFetch.mockResolvedValueOnce(graphqlResponse({ context: { nodes: [], decisions: [] } }));

      await client.callTool({
        name: "whygraph_context",
        arguments: { file: "src/auth.ts", symbol: "authenticate" },
      });

      const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.variables.symbol).toBe("authenticate");
    });
  });

  describe("whygraph_get_decisions", () => {
    it("passes filters correctly", async () => {
      const decisions = [
        { id: "d1", title: "Use JWT", status: "active", date: "2026-03-24", affects: [], tags: ["security"] },
      ];
      mockFetch.mockResolvedValueOnce(graphqlResponse({ decisions }));

      const result = await client.callTool({
        name: "whygraph_get_decisions",
        arguments: { status: "active", tags: ["security"], dateFrom: "2026-01-01", dateTo: "2026-12-31" },
      });

      const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.variables.status).toBe("active");
      expect(body.variables.tags).toEqual(["security"]);
      expect(body.variables.dateFrom).toBe("2026-01-01");
      expect(body.variables.dateTo).toBe("2026-12-31");
      expect(body.query).toContain("decisions(");

      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe("d1");
    });

    it("works with no filters", async () => {
      mockFetch.mockResolvedValueOnce(graphqlResponse({ decisions: [] }));

      await client.callTool({ name: "whygraph_get_decisions", arguments: {} });

      const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.variables).toEqual({});
    });
  });

  describe("whygraph_get_gaps", () => {
    it("passes limit correctly", async () => {
      const gaps = [{ id: "n1", label: "Feature", name: "Payments", status: "active", parent: null }];
      mockFetch.mockResolvedValueOnce(graphqlResponse({ gaps }));

      const result = await client.callTool({
        name: "whygraph_get_gaps",
        arguments: { limit: 5 },
      });

      const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.variables.limit).toBe(5);
      expect(body.query).toContain("gaps(limit: $limit)");

      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe("n1");
    });

    it("works without limit", async () => {
      mockFetch.mockResolvedValueOnce(graphqlResponse({ gaps: [] }));

      await client.callTool({ name: "whygraph_get_gaps", arguments: {} });

      const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.variables).toEqual({});
    });
  });

  describe("whygraph_list_nodes", () => {
    it("passes filters correctly", async () => {
      const nodes = [{ id: "n1", label: "Component", name: "LoginForm", parent: "feat1" }];
      mockFetch.mockResolvedValueOnce(graphqlResponse({ nodes }));

      const result = await client.callTool({
        name: "whygraph_list_nodes",
        arguments: { label: "Component", parent: "feat1", search: "Login" },
      });

      const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.variables.label).toBe("Component");
      expect(body.variables.parent).toBe("feat1");
      expect(body.variables.search).toBe("Login");
      expect(body.query).toContain("nodes(");

      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("LoginForm");
    });
  });

  describe("error handling", () => {
    it("returns clear error when server is not running", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fetch failed"));

      const result = await client.callTool({
        name: "whygraph_context",
        arguments: { file: "src/auth.ts" },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("Cannot connect to whygraph server");
      expect(content[0].text).toContain("whygraph serve");
      expect(result.isError).toBe(true);
    });

    it("returns GraphQL errors clearly", async () => {
      mockFetch.mockResolvedValueOnce(graphqlErrorResponse("Field 'foo' not found"));

      const result = await client.callTool({
        name: "whygraph_context",
        arguments: { file: "src/auth.ts" },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("GraphQL error");
      expect(content[0].text).toContain("Field 'foo' not found");
      expect(result.isError).toBe(true);
    });
  });

  describe("port configuration", () => {
    it("uses WHYGRAPH_PORT env var when set", async () => {
      process.env["WHYGRAPH_PORT"] = "9999";
      mockFetch.mockResolvedValueOnce(graphqlResponse({ context: { nodes: [], decisions: [] } }));

      await client.callTool({
        name: "whygraph_context",
        arguments: { file: "src/auth.ts" },
      });

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:9999/api/graphql");
    });
  });
});
