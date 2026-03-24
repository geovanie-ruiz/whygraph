---
# whygraph-40uk
title: 'Temporal projection: created_at/removed_at filtering'
status: completed
type: task
priority: critical
tags:
    - afk
    - core
created_at: 2026-03-24T05:32:48Z
updated_at: 2026-03-24T06:07:50Z
parent: whygraph-ileg
blocked_by:
    - whygraph-whi8
---

## What to build

Filter entities by created_at/removed_at before projecting the graph. Given a timestamp T, include entities where created_at <= T AND (removed_at is null OR removed_at > T). Build the graph from the filtered set. This enables the timeline scrubber to show the graph at any point in history.

## Acceptance criteria

- [ ] Filters entities by timestamp window
- [ ] Entities without removed_at are always included (up to T)
- [ ] Entities with removed_at are excluded after that timestamp
- [ ] Edges derived correctly from filtered entity set
- [ ] Returns empty graph for timestamp before any entity exists

## User stories addressed

- User story 6, 7, 30
