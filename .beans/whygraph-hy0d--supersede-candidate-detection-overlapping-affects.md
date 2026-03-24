---
# whygraph-hy0d
title: 'Supersede candidate detection: overlapping affects'
status: todo
type: task
priority: normal
tags:
    - afk
    - core
created_at: 2026-03-24T05:32:48Z
updated_at: 2026-03-24T05:32:48Z
parent: whygraph-ileg
blocked_by:
    - whygraph-whi8
---

## What to build

Detect when a new or existing decision has overlapping affects with another active decision. Two decisions are supersede candidates if they share one or more affects targets and neither already has a supersedes relationship with the other. Computed from the entity map, not persisted.

## Acceptance criteria

- [ ] Detects overlapping affects between active decisions
- [ ] Excludes pairs that already have a supersedes relationship
- [ ] Returns list of candidate pairs with shared node IDs
- [ ] Pure function, no side effects
- [ ] Recomputes on demand (not cached)

## User stories addressed

- User story 9
