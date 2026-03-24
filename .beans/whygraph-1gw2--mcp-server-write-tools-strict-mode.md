---
# whygraph-1gw2
title: 'MCP server: write tools (strict mode)'
status: todo
type: task
priority: normal
tags:
    - afk
    - mcp
created_at: 2026-03-24T05:35:23Z
updated_at: 2026-03-24T05:35:24Z
parent: whygraph-ileg
blocked_by:
    - whygraph-v3mi
---

## What to build

MCP write tools: whygraph_create_decision(...), whygraph_create_node(...). Available only when config.yaml has strict MCP mode enabled. Each tool makes a GraphQL mutation. Validation errors returned as MCP tool response.

## Acceptance criteria

- [ ] Two write tools registered
- [ ] Only available when strict mode enabled in config
- [ ] Each tool calls GraphQL mutation
- [ ] Validation errors returned in tool response
- [ ] Created entity returned on success

## User stories addressed

- User story 13, 21
