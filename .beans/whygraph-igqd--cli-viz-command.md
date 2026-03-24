---
# whygraph-igqd
title: CLI viz command
status: completed
type: task
priority: normal
tags:
    - afk
    - cli
created_at: 2026-03-24T05:33:40Z
updated_at: 2026-03-24T06:39:15Z
parent: whygraph-ileg
blocked_by:
    - whygraph-sauw
    - whygraph-fxnn
---

## What to build

Implement `whygraph viz` — open the default browser to the React frontend URL. If the server isn't running, start it in background first, wait for health check, then open browser.

## Acceptance criteria

- [ ] Opens browser to frontend URL
- [ ] Detects if server is running (health check)
- [ ] Starts server if needed, waits for ready
- [ ] Prints URL to stdout

## User stories addressed

- User story 35
