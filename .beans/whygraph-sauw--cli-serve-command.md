---
# whygraph-sauw
title: CLI serve command
status: completed
type: task
priority: high
tags:
    - afk
    - cli
created_at: 2026-03-24T05:33:40Z
updated_at: 2026-03-24T06:33:05Z
parent: whygraph-ileg
blocked_by:
    - whygraph-8l5e
---

## What to build

Implement `whygraph serve` — start the HTTP server in the foreground. Loads entities, builds graph, starts file watcher, starts GraphQL API + frontend serving. Prints port and URL on startup. Graceful shutdown on SIGINT/SIGTERM.

## Acceptance criteria

- [ ] Starts HTTP server on configured port
- [ ] Loads all entities and builds graph on startup
- [ ] Starts file watcher
- [ ] Prints URL on ready
- [ ] Graceful shutdown on signals
- [ ] Exits with error if port is in use

## User stories addressed

- User story 4
