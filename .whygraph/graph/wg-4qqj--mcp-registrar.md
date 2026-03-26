---
id: wg-4qqj
label: Component
name: MCP Registrar
status: active
parent: wg-plat
refs:
  - file: src/platform/rules.ts
    symbol: registerMcpWithClaude
  - file: src/platform/rules.ts
    symbol: registerMcpWithCursor
  - file: src/platform/rules.ts
    symbol: registerMcpWithCopilot
created_at: "2026-03-25T23:23:41.323Z"
updated_at: "2026-03-25T23:23:41.323Z"
---
Registers the whygraph MCP server with the host AI environment during init. Tries the environment's native registration mechanism first, falls back to writing config files directly, and writes MCP_SETUP.md if all else fails.
