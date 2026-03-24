---
# whygraph-5faf
title: 'getGaps: nodes with no inbound AFFECTS edges'
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

Find structural nodes (Feature, Component) with no inbound AFFECTS edges from any active Decision. Order: Features first, then Components by depth. Optional limit parameter as hard truncation.

## Acceptance criteria

- [ ] Finds Feature/Component nodes with zero AFFECTS edges
- [ ] Orders Features first, then Components by depth
- [ ] Respects optional limit (slice, not paginate)
- [ ] Excludes removed nodes (removed_at set)
- [ ] Pure function against the graph

## User stories addressed

- User story 8, 17
