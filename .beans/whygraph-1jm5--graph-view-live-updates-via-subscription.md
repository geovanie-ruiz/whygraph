---
# whygraph-1jm5
title: 'Graph view: live updates via subscription'
status: todo
type: task
priority: high
tags:
    - afk
    - frontend
created_at: 2026-03-24T05:35:24Z
updated_at: 2026-03-24T05:35:24Z
parent: whygraph-ileg
blocked_by:
    - whygraph-tupg
    - whygraph-7zcc
---

## What to build

Wire the GraphQL subscription to the D3 graph view. When an entity_created/updated/deleted event arrives, update the D3 simulation data and re-render. Nodes appear/disappear/move smoothly. No page refresh needed.

## Acceptance criteria

- [ ] New entities appear in graph without refresh
- [ ] Updated entities reflect changes (status, label)
- [ ] Deleted entities disappear from graph
- [ ] D3 simulation handles dynamic data changes smoothly
- [ ] No flicker or full re-render on updates

## User stories addressed

- User story 5
