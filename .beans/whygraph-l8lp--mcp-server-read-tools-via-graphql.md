---
# whygraph-l8lp
title: 'MCP server: read tools via GraphQL'
status: completed
type: task
priority: high
tags:
    - afk
    - mcp
created_at: 2026-03-24T05:35:23Z
updated_at: 2026-03-24T06:33:05Z
parent: whygraph-ileg
blocked_by:
    - whygraph-lzmh
---

## What to build

MCP server with read tools that query the whygraph HTTP server via GraphQL. Tools: whygraph_context(file, symbol?), whygraph_get_decisions(filters?), whygraph_get_gaps(limit?), whygraph_list_nodes(label?, parent?, search?). Each tool makes a GraphQL query and returns structured results.

## Acceptance criteria

- [ ] MCP server registers 4 read tools
- [ ] Each tool makes a GraphQL query to local server
- [ ] Returns structured results matching MCP protocol
- [ ] Handles server-not-running gracefully (clear error message)
- [ ] Tools validate input parameters

## User stories addressed

- User story 14, 15, 16, 17
