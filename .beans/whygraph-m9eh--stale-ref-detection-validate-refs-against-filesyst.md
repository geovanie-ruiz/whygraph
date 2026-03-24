---
# whygraph-m9eh
title: 'Stale ref detection: validate refs against filesystem'
status: completed
type: task
priority: normal
tags:
    - afk
    - server
created_at: 2026-03-24T05:34:05Z
updated_at: 2026-03-24T06:18:55Z
parent: whygraph-ileg
blocked_by:
    - whygraph-8l5e
---

## What to build

For each structural node with refs, check if the referenced files exist on the filesystem. Flag refs that point to nonexistent files. Recompute on entity change and on file watcher events. Expose stale refs via server core for API consumers.

## Acceptance criteria

- [ ] Checks all ref file paths against filesystem
- [ ] Flags stale refs (file not found)
- [ ] Recomputes incrementally on entity changes
- [ ] Exposes stale refs list via server core
- [ ] Handles missing .whygraph/ gracefully

## User stories addressed

- User story 10
