---
# whygraph-o2fg
title: 'Detail panel: full decision content on click'
status: completed
type: task
priority: high
tags:
    - afk
    - frontend
created_at: 2026-03-24T05:35:24Z
updated_at: 2026-03-24T06:48:36Z
parent: whygraph-ileg
blocked_by:
    - whygraph-tupg
---

## What to build

Side panel that shows full decision content when a decision node is clicked in the graph. Displays: title, status, date, tags, context, decision, tradeoffs, alternatives, affected nodes. Closes when clicking elsewhere.

## Acceptance criteria

- [ ] Opens on decision node click
- [ ] Shows all decision fields (title, status, date, tags)
- [ ] Shows markdown body sections (context, decision, tradeoffs, alternatives)
- [ ] Shows affected node names (not just IDs)
- [ ] Closes on deselect

## User stories addressed

- User story 34
