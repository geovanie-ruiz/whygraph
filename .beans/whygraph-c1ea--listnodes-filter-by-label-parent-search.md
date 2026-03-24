---
# whygraph-c1ea
title: 'listNodes: filter by label, parent, search'
status: completed
type: task
priority: high
tags:
    - afk
    - core
created_at: 2026-03-24T05:33:12Z
updated_at: 2026-03-24T06:09:05Z
parent: whygraph-ileg
blocked_by:
    - whygraph-whi8
---

## What to build

List nodes with optional filtering by label (App/Feature/Component/Decision), parent ID, and search term (matches name/title). Used by agents to discover valid IDs for the affects field. Returns entity ID, label, name/title, and parent.

## Acceptance criteria

- [ ] Filters by label type
- [ ] Filters by parent ID
- [ ] Search by keyword against name/title
- [ ] Returns id, label, name/title, parent for each match
- [ ] Returns all nodes when no filters provided

## User stories addressed

- User story 14
