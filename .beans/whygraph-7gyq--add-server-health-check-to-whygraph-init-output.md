---
# whygraph-7gyq
title: Add server health check to whygraph init output
status: todo
type: task
priority: low
created_at: 2026-03-25T03:55:20Z
updated_at: 2026-03-25T03:55:20Z
parent: whygraph-rqnp
---

After whygraph init completes, check if the server is running via health endpoint.
If not running, output: "Run 'whygraph up' to start the server."
If running, output: "Server already running on port N."

This is informational only — init should succeed regardless of server state.
