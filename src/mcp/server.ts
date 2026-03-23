import * as fs from "node:fs";
import * as path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findEventsFile, loadEvents } from "../core/events.js";
import { buildGraph } from "../core/projection.js";
import { getContext, getDecisions, getGaps } from "../core/query.js";
import { loadReviews } from "../staging/reviews.js";
import { loadErrors } from "../staging/errors.js";
import type { MultiDirectedGraph } from "graphology";
import type { DecisionFilters } from "../core/query.js";

// ── Types ────────────────────────────────────────────────────

export interface ServerState {
  graph: MultiDirectedGraph | null;
  eventsPath: string | null;
  whygraphDir: string | null;
  lastMtime: number;
}

// ── Staleness ────────────────────────────────────────────────

export function getEventsMtime(eventsPath: string): number {
  try {
    return fs.statSync(eventsPath).mtimeMs;
  } catch {
    return 0;
  }
}

export function isStale(state: ServerState): boolean {
  if (state.eventsPath === null) return false;
  const currentMtime = getEventsMtime(state.eventsPath);
  return currentMtime !== state.lastMtime;
}

// ── Graph loading ────────────────────────────────────────────

export function loadGraph(state: ServerState): void {
  if (state.eventsPath === null) return;
  const events = loadEvents(state.eventsPath);
  state.graph = buildGraph(events);
  state.lastMtime = getEventsMtime(state.eventsPath);
}

// ── Initialization ───────────────────────────────────────────

export function initState(startDir: string): ServerState {
  const eventsPath = findEventsFile(startDir);
  const state: ServerState = {
    graph: null,
    eventsPath,
    whygraphDir: eventsPath ? path.dirname(eventsPath) : null,
    lastMtime: 0,
  };

  if (eventsPath) {
    loadGraph(state);
  }

  return state;
}

// ── Staleness error result ───────────────────────────────────

function stalenessError() {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: "stale_graph",
          message:
            "The graph is stale — events.jsonl has been modified since last load. Please restart the MCP server to reload.",
        }),
      },
    ],
    isError: true,
  };
}

function noGraphError() {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: "no_graph",
          message:
            "No .whygraph/ directory found. Run 'whygraph init' to create one.",
        }),
      },
    ],
    isError: true,
  };
}

// ── Server factory ───────────────────────────────────────────

export function createServer(
  state: ServerState,
): McpServer {
  const server = new McpServer({
    name: "whygraph",
    version: "0.1.0",
  });

  // ── whygraph_context ─────────────────────────────────────

  server.tool(
    "whygraph_context",
    "Get architectural context (decisions, parent chain) for a file and optional symbol",
    {
      file: z.string().describe("File path to look up"),
      symbol: z.string().optional().describe("Optional symbol name within the file"),
    },
    async ({ file, symbol }) => {
      if (state.graph === null) return noGraphError();
      if (isStale(state)) return stalenessError();

      const result = getContext(state.graph, file, symbol);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    },
  );

  // ── whygraph_get_decisions ───────────────────────────────

  server.tool(
    "whygraph_get_decisions",
    "Filter and list decision node IDs by status, tags, and date range",
    {
      status: z
        .enum(["active", "superseded"])
        .optional()
        .describe("Filter by decision status"),
      tags: z
        .array(
          z.enum([
            "arch",
            "data",
            "security",
            "performance",
            "integration",
            "infra",
            "ux",
          ]),
        )
        .optional()
        .describe("Filter by tags (OR logic — matches if decision has ANY tag)"),
      after: z
        .string()
        .optional()
        .describe("Filter decisions on or after this ISO date"),
      before: z
        .string()
        .optional()
        .describe("Filter decisions on or before this ISO date"),
    },
    async ({ status, tags, after, before }) => {
      if (state.graph === null) return noGraphError();
      if (isStale(state)) return stalenessError();

      const filters: DecisionFilters = {};
      if (status !== undefined) filters.status = status;
      if (tags !== undefined) filters.tags = tags;
      if (after !== undefined) filters.after = after;
      if (before !== undefined) filters.before = before;

      const result = getDecisions(state.graph, filters);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    },
  );

  // ── whygraph_get_gaps ────────────────────────────────────

  server.tool(
    "whygraph_get_gaps",
    "Find Feature and Component nodes with no recorded decisions",
    {
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum number of gap nodes to return"),
    },
    async ({ limit }) => {
      if (state.graph === null) return noGraphError();
      if (isStale(state)) return stalenessError();

      const result = getGaps(state.graph, limit);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    },
  );

  // ── whygraph_get_reviews ─────────────────────────────────

  server.tool(
    "whygraph_get_reviews",
    "Load pending reviews from reviews.jsonl",
    {},
    async () => {
      if (state.whygraphDir === null) return noGraphError();

      const reviews = await loadReviews(state.whygraphDir);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(reviews),
          },
        ],
      };
    },
  );

  // ── whygraph_get_errors ──────────────────────────────────

  server.tool(
    "whygraph_get_errors",
    "Load processing errors from errors.jsonl",
    {},
    async () => {
      if (state.whygraphDir === null) return noGraphError();

      const errors = await loadErrors(state.whygraphDir);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(errors),
          },
        ],
      };
    },
  );

  return server;
}
