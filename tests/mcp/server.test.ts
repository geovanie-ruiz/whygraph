import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createServer,
  initState,
  isStale,
  getEventsMtime,
  loadGraph,
} from "../../src/mcp/server.js";
import type { ServerState } from "../../src/mcp/server.js";
import type {
  NodeAddedEvent,
  EdgeAddedEvent,
  WhyEvent,
} from "../../src/core/types.js";

// ── Helpers ──────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "whygraph-mcp-test-"));
}

function setupWhygraphDir(tmpDir: string): string {
  const whygraphDir = path.join(tmpDir, ".whygraph");
  fs.mkdirSync(whygraphDir, { recursive: true });
  return whygraphDir;
}

function writeEvents(eventsPath: string, events: WhyEvent[]): void {
  const content = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  fs.writeFileSync(eventsPath, content, "utf-8");
}

function makeAppEvent(): NodeAddedEvent {
  return {
    type: "node_added",
    timestamp: "2026-03-22T00:00:00Z",
    id: "app-1",
    label: "App",
    properties: { name: "TestApp" },
  };
}

function makeFeatureEvent(
  id: string,
  refs?: Array<{ file: string; symbol?: string }>,
): NodeAddedEvent {
  return {
    type: "node_added",
    timestamp: "2026-03-22T00:01:00Z",
    id,
    label: "Feature",
    properties: { name: `Feature ${id}`, refs },
  };
}

function makeComponentEvent(
  id: string,
  refs?: Array<{ file: string; symbol?: string }>,
): NodeAddedEvent {
  return {
    type: "node_added",
    timestamp: "2026-03-22T00:02:00Z",
    id,
    label: "Component",
    properties: { name: `Component ${id}`, refs },
  };
}

function makeDecisionEvent(
  id: string,
  overrides?: Partial<Record<string, unknown>>,
): NodeAddedEvent {
  return {
    type: "node_added",
    timestamp: "2026-03-22T00:03:00Z",
    id,
    label: "Decision",
    properties: {
      title: `Decision ${id}`,
      date: "2026-03-22",
      context: "test context",
      decision: "test decision",
      tradeoffs: "test tradeoffs",
      alternatives: "test alternatives",
      status: "active",
      affects: [],
      tags: ["arch"],
      ...overrides,
    },
  };
}

function makeEdgeEvent(
  id: string,
  from: string,
  to: string,
  label: "COMPOSES" | "AFFECTS" = "COMPOSES",
): EdgeAddedEvent {
  return {
    type: "edge_added",
    timestamp: "2026-03-22T00:04:00Z",
    id,
    label,
    from,
    to,
  };
}

function buildTestEvents(): WhyEvent[] {
  return [
    makeAppEvent(),
    makeFeatureEvent("feat-1", [{ file: "src/core/query.ts" }]),
    makeComponentEvent("comp-1", [
      { file: "src/core/query.ts", symbol: "getContext" },
    ]),
    makeDecisionEvent("dec-1"),
    makeEdgeEvent("e-1", "app-1", "feat-1", "COMPOSES"),
    makeEdgeEvent("e-2", "feat-1", "comp-1", "COMPOSES"),
    makeEdgeEvent("e-3", "dec-1", "feat-1", "AFFECTS"),
  ];
}

async function createTestClient(
  state: ServerState,
): Promise<Client> {
  const server = createServer(state);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "0.1.0" });
  await client.connect(clientTransport);
  return client;
}

// ── Tests ────────────────────────────────────────────────────

describe("MCP Server", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── initState ──────────────────────────────────────────────

  describe("initState", () => {
    it("returns null graph when no .whygraph dir exists", () => {
      const state = initState(tmpDir);
      expect(state.graph).toBeNull();
      expect(state.eventsPath).toBeNull();
      expect(state.whygraphDir).toBeNull();
    });

    it("loads graph when .whygraph dir exists", () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, [makeAppEvent()]);

      const state = initState(tmpDir);
      expect(state.graph).not.toBeNull();
      expect(state.eventsPath).toBe(eventsPath);
      expect(state.whygraphDir).toBe(whygraphDir);
      expect(state.graph!.order).toBe(1);
    });
  });

  // ── Staleness ──────────────────────────────────────────────

  describe("staleness", () => {
    it("isStale returns false when graph is fresh", () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, [makeAppEvent()]);

      const state = initState(tmpDir);
      expect(isStale(state)).toBe(false);
    });

    it("isStale returns true after events.jsonl is modified", () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, [makeAppEvent()]);

      const state = initState(tmpDir);

      // Modify the file with a new mtime
      const futureTime = Date.now() + 5000;
      fs.utimesSync(eventsPath, futureTime / 1000, futureTime / 1000);

      expect(isStale(state)).toBe(true);
    });

    it("isStale returns false when no events path", () => {
      const state = initState(tmpDir);
      expect(isStale(state)).toBe(false);
    });

    it("getEventsMtime returns 0 for non-existent file", () => {
      expect(getEventsMtime("/nonexistent/path")).toBe(0);
    });

    it("loadGraph updates mtime tracking", () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, [makeAppEvent()]);

      const state = initState(tmpDir);
      const originalMtime = state.lastMtime;

      // Modify file
      const futureTime = Date.now() + 5000;
      fs.utimesSync(eventsPath, futureTime / 1000, futureTime / 1000);
      expect(isStale(state)).toBe(true);

      // Reload
      loadGraph(state);
      expect(isStale(state)).toBe(false);
      expect(state.lastMtime).not.toBe(originalMtime);
    });
  });

  // ── Tool: whygraph_context ─────────────────────────────────

  describe("whygraph_context", () => {
    it("returns context for a file with matching nodes", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, buildTestEvents());

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.callTool({
        name: "whygraph_context",
        arguments: { file: "src/core/query.ts" },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(parsed.nodes.length).toBeGreaterThanOrEqual(1);
      expect(parsed.decisions.length).toBeGreaterThanOrEqual(1);
    });

    it("returns null for a file with no matching nodes", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, buildTestEvents());

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.callTool({
        name: "whygraph_context",
        arguments: { file: "nonexistent.ts" },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(parsed).toBeNull();
    });

    it("filters by symbol when provided", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, buildTestEvents());

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.callTool({
        name: "whygraph_context",
        arguments: { file: "src/core/query.ts", symbol: "getContext" },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(parsed.nodes.length).toBeGreaterThanOrEqual(1);
    });

    it("returns no_graph error when no .whygraph exists", async () => {
      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.callTool({
        name: "whygraph_context",
        arguments: { file: "src/core/query.ts" },
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(parsed.error).toBe("no_graph");
    });

    it("returns staleness error when graph is stale", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, buildTestEvents());

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      // Make stale
      const futureTime = Date.now() + 5000;
      fs.utimesSync(eventsPath, futureTime / 1000, futureTime / 1000);

      const result = await client.callTool({
        name: "whygraph_context",
        arguments: { file: "src/core/query.ts" },
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(parsed.error).toBe("stale_graph");
    });
  });

  // ── Tool: whygraph_get_decisions ───────────────────────────

  describe("whygraph_get_decisions", () => {
    it("returns decision IDs with no filters", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, buildTestEvents());

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.callTool({
        name: "whygraph_get_decisions",
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(parsed).toContain("dec-1");
    });

    it("filters by status", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, [
        ...buildTestEvents(),
        makeDecisionEvent("dec-2", { status: "superseded" }),
      ]);

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.callTool({
        name: "whygraph_get_decisions",
        arguments: { status: "active" },
      });

      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(parsed).toContain("dec-1");
      expect(parsed).not.toContain("dec-2");
    });

    it("filters by tags", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, [
        ...buildTestEvents(),
        makeDecisionEvent("dec-2", { tags: ["data"] }),
      ]);

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.callTool({
        name: "whygraph_get_decisions",
        arguments: { tags: ["data"] },
      });

      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(parsed).toContain("dec-2");
      expect(parsed).not.toContain("dec-1");
    });

    it("returns staleness error when graph is stale", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, buildTestEvents());

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const futureTime = Date.now() + 5000;
      fs.utimesSync(eventsPath, futureTime / 1000, futureTime / 1000);

      const result = await client.callTool({
        name: "whygraph_get_decisions",
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(parsed.error).toBe("stale_graph");
    });
  });

  // ── Tool: whygraph_get_gaps ────────────────────────────────

  describe("whygraph_get_gaps", () => {
    it("returns gap nodes with no decisions", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      // feat-1 has AFFECTS from dec-1, but add a feature without decisions
      writeEvents(eventsPath, [
        ...buildTestEvents(),
        makeFeatureEvent("feat-2"),
        makeEdgeEvent("e-4", "app-1", "feat-2", "COMPOSES"),
      ]);

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.callTool({
        name: "whygraph_get_gaps",
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      const gapIds = parsed.map((g: { id: string }) => g.id);
      expect(gapIds).toContain("feat-2");
    });

    it("respects limit parameter", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, [
        ...buildTestEvents(),
        makeFeatureEvent("feat-2"),
        makeFeatureEvent("feat-3"),
        makeEdgeEvent("e-4", "app-1", "feat-2", "COMPOSES"),
        makeEdgeEvent("e-5", "app-1", "feat-3", "COMPOSES"),
      ]);

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.callTool({
        name: "whygraph_get_gaps",
        arguments: { limit: 1 },
      });

      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(parsed.length).toBe(1);
    });

    it("returns staleness error when graph is stale", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, buildTestEvents());

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const futureTime = Date.now() + 5000;
      fs.utimesSync(eventsPath, futureTime / 1000, futureTime / 1000);

      const result = await client.callTool({
        name: "whygraph_get_gaps",
        arguments: {},
      });

      expect(result.isError).toBe(true);
    });
  });

  // ── Tool: whygraph_get_reviews ─────────────────────────────

  describe("whygraph_get_reviews", () => {
    it("returns empty array when no reviews file exists", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, [makeAppEvent()]);

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.callTool({
        name: "whygraph_get_reviews",
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(parsed).toEqual([]);
    });

    it("returns reviews from JSONL file", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, [makeAppEvent()]);

      const review = {
        id: "review-1",
        newDecisionId: "dec-new",
        existingDecisionId: "dec-old",
        sharedNodeIds: ["node-1"],
        status: "pending",
      };
      fs.writeFileSync(
        path.join(whygraphDir, "reviews.jsonl"),
        JSON.stringify(review) + "\n",
        "utf-8",
      );

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.callTool({
        name: "whygraph_get_reviews",
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(parsed.length).toBe(1);
      expect(parsed[0].id).toBe("review-1");
    });

    it("returns no_graph error when no .whygraph exists", async () => {
      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.callTool({
        name: "whygraph_get_reviews",
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(parsed.error).toBe("no_graph");
    });
  });

  // ── Tool: whygraph_get_errors ──────────────────────────────

  describe("whygraph_get_errors", () => {
    it("returns empty array when no errors file exists", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, [makeAppEvent()]);

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.callTool({
        name: "whygraph_get_errors",
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(parsed).toEqual([]);
    });

    it("returns errors from JSONL file", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, [makeAppEvent()]);

      const error = {
        entry: "bad entry",
        error: "parse failed",
        file: "staging/test.md",
      };
      fs.writeFileSync(
        path.join(whygraphDir, "errors.jsonl"),
        JSON.stringify(error) + "\n",
        "utf-8",
      );

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.callTool({
        name: "whygraph_get_errors",
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(parsed.length).toBe(1);
      expect(parsed[0].error).toBe("parse failed");
    });

    it("returns no_graph error when no .whygraph exists", async () => {
      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.callTool({
        name: "whygraph_get_errors",
        arguments: {},
      });

      expect(result.isError).toBe(true);
    });
  });

  // ── Tool listing ───────────────────────────────────────────

  describe("tool listing", () => {
    it("lists all 5 tools", async () => {
      const whygraphDir = setupWhygraphDir(tmpDir);
      const eventsPath = path.join(whygraphDir, "events.jsonl");
      writeEvents(eventsPath, [makeAppEvent()]);

      const state = initState(tmpDir);
      const client = await createTestClient(state);

      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);
      expect(toolNames).toContain("whygraph_context");
      expect(toolNames).toContain("whygraph_get_decisions");
      expect(toolNames).toContain("whygraph_get_gaps");
      expect(toolNames).toContain("whygraph_get_reviews");
      expect(toolNames).toContain("whygraph_get_errors");
      expect(result.tools.length).toBe(5);
    });
  });
});
