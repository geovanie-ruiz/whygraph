import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

const DEFAULT_PORT = 4777;

function getPort(): number {
  const env = process.env["WHYGRAPH_PORT"];
  if (env) {
    const parsed = parseInt(env, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_PORT;
}

function getEndpoint(): string {
  return `http://localhost:${getPort()}/api/graphql`;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function queryGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const endpoint = getEndpoint();
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error(
      `Cannot connect to whygraph server at ${endpoint}. Is the server running? Start it with: whygraph serve`
    );
  }

  const json = (await response.json()) as GraphQLResponse<T>;
  if (json.errors && json.errors.length > 0) {
    throw new Error(`GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`);
  }
  if (!json.data) {
    throw new Error("No data returned from GraphQL query");
  }
  return json.data;
}

function textResult(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string): { content: Array<{ type: "text"; text: string }>; isError: true } {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "whygraph",
    version: "0.2.0",
  });

  // whygraph_context
  server.registerTool("whygraph_context", {
    description:
      "Get architectural context for a file/symbol. Returns structural nodes and decisions that affect the given code location.",
    inputSchema: {
      file: z.string().describe("File path to get context for"),
      symbol: z.string().optional().describe("Optional symbol name within the file"),
    },
  }, async ({ file, symbol }) => {
    try {
      const variables: Record<string, unknown> = { file };
      if (symbol !== undefined) variables["symbol"] = symbol;

      const query = `
        query Context($file: String!, $symbol: String) {
          context(file: $file, symbol: $symbol) {
            nodes { id label name parentChain }
            decisions { id attributes }
          }
        }
      `;
      const data = await queryGraphQL<{ context: unknown }>(query, variables);
      return textResult(data.context);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  });

  // whygraph_get_decisions
  server.registerTool("whygraph_get_decisions", {
    description: "Query decisions with optional filters for status, tags, and date range.",
    inputSchema: {
      status: z.string().optional().describe("Filter by decision status (active or superseded)"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      dateFrom: z.string().optional().describe("Filter decisions from this date (YYYY-MM-DD)"),
      dateTo: z.string().optional().describe("Filter decisions up to this date (YYYY-MM-DD)"),
    },
  }, async ({ status, tags, dateFrom, dateTo }) => {
    try {
      const variables: Record<string, unknown> = {};
      if (status !== undefined) variables["status"] = status;
      if (tags !== undefined) variables["tags"] = tags;
      if (dateFrom !== undefined) variables["dateFrom"] = dateFrom;
      if (dateTo !== undefined) variables["dateTo"] = dateTo;

      const query = `
        query Decisions($status: String, $tags: [String!], $dateFrom: String, $dateTo: String) {
          decisions(status: $status, tags: $tags, dateFrom: $dateFrom, dateTo: $dateTo) {
            id title status date affects tags context decision tradeoffs alternatives
          }
        }
      `;
      const data = await queryGraphQL<{ decisions: unknown }>(query, variables);
      return textResult(data.decisions);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  });

  // whygraph_get_gaps
  server.registerTool("whygraph_get_gaps", {
    description: "Find structural nodes that have no associated decisions (coverage gaps).",
    inputSchema: {
      limit: z.number().optional().describe("Maximum number of gaps to return"),
    },
  }, async ({ limit }) => {
    try {
      const variables: Record<string, unknown> = {};
      if (limit !== undefined) variables["limit"] = limit;

      const query = `
        query Gaps($limit: Int) {
          gaps(limit: $limit) {
            id label name status parent
          }
        }
      `;
      const data = await queryGraphQL<{ gaps: unknown }>(query, variables);
      return textResult(data.gaps);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  });

  // whygraph_list_nodes
  server.registerTool("whygraph_list_nodes", {
    description: "List structural nodes with optional filters for label, parent, and search text.",
    inputSchema: {
      label: z.string().optional().describe("Filter by node label (App, Feature, Component)"),
      parent: z.string().optional().describe("Filter by parent node ID"),
      search: z.string().optional().describe("Search nodes by name"),
    },
  }, async ({ label, parent, search }) => {
    try {
      const variables: Record<string, unknown> = {};
      if (label !== undefined) variables["label"] = label;
      if (parent !== undefined) variables["parent"] = parent;
      if (search !== undefined) variables["search"] = search;

      const query = `
        query Nodes($label: String, $parent: String, $search: String) {
          nodes(label: $label, parent: $parent, search: $search) {
            id label name parent
          }
        }
      `;
      const data = await queryGraphQL<{ nodes: unknown }>(query, variables);
      return textResult(data.nodes);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  });

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
