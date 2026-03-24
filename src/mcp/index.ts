#!/usr/bin/env node
/**
 * MCP server entrypoint. When run directly, starts the stdio-based MCP server.
 * For programmatic use, import from ./server.js instead.
 */
import { startMcpServer } from "./server.js";

startMcpServer().catch((err: unknown) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
