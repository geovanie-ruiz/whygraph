---
# whygraph-2kpk
title: Fix MPC → MCP typo across codebase
status: todo
type: task
priority: high
created_at: 2026-03-25T03:55:20Z
updated_at: 2026-03-25T03:55:20Z
parent: whygraph-rqnp
---

Rename all occurrences of MPC to MCP:
- config.yaml field: mpcMode → mcpMode
- types.ts: MpcMode type → McpMode
- server.ts: WHYGRAPH_MPC_MODE env var → WHYGRAPH_MCP_MODE
- prime.ts: "MPC Mode" output → "MCP Mode"
- Any other references

This is a breaking change to config.yaml — existing installs will need to update their config.
