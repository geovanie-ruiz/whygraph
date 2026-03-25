---
# whygraph-mbau
title: Strict mode fallback to default when server unreachable
status: completed
type: task
priority: normal
created_at: 2026-03-25T03:55:20Z
updated_at: 2026-03-25T05:04:31Z
parent: whygraph-rqnp
---

In strict mode, MCP tools call the server's GraphQL endpoint. If the server is unreachable (died mid-session), the MCP tool should fall back to direct file write (default mode behavior). The issue sidecar system catches any validation problems later.

The agent should never be blocked from capturing a decision.
