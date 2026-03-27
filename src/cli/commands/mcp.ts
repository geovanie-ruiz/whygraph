import type { Command } from "commander";
import { startMcpServer } from "../../mcp/server.js";

export function registerMcpCommand(program: Command): void {
  program
    .command("mcp")
    .description("Start the MCP stdio server")
    .action(/* v8 ignore next 3 */ async () => {
      await startMcpServer();
    });
}
