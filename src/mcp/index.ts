import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, initState } from "./server.js";

export async function main(): Promise<void> {
  const state = initState(process.cwd());
  const server = createServer(state);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
