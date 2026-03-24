---
# whygraph-y1l2
title: 'getDecisions: filter by tags, status, date range'
status: todo
type: task
priority: critical
tags:
    - afk
    - core
created_at: 2026-03-24T05:33:12Z
updated_at: 2026-03-24T05:33:12Z
parent: whygraph-ileg
blocked_by:
    - whygraph-whi8
---

## What to build

Filter decisions by status, tags (OR logic within tags), and date range (AND logic between filter types). Return decision entities matching the filters. Pure function against the graph or entity map.

## Acceptance criteria

- [ ] Filters by status (active, superseded)
- [ ] Filters by tags with OR logic (any tag matches)
- [ ] Filters by date range (from/to, AND with other filters)
- [ ] Returns full decision entities, not just IDs
- [ ] Returns all decisions when no filters provided

## User stories addressed

- User story 16
