---
# whygraph-oq6u
title: 'File watcher: chokidar on .whygraph/graph/'
status: completed
type: task
priority: critical
tags:
    - afk
    - server
created_at: 2026-03-24T05:34:05Z
updated_at: 2026-03-24T06:16:18Z
parent: whygraph-ileg
blocked_by:
    - whygraph-8l5e
---

## What to build

Wrap chokidar to watch .whygraph/graph/ for file changes. Debounce events (100ms). On add/change: parse the file, update entity map, update graph, emit typed event (created/updated). On delete: remove from map, update graph, emit deleted event. Handle rapid successive changes gracefully.

## Acceptance criteria

- [ ] Watches .whygraph/graph/ directory
- [ ] Debounces events at 100ms
- [ ] Incremental parse on add/change
- [ ] Remove on delete
- [ ] Emits typed change events
- [ ] Handles rapid file changes without race conditions

## User stories addressed

- User story 28
