---
# whygraph-6lmp
title: 'Stale ref UI: flag + modal to update'
status: todo
type: task
priority: normal
tags:
    - afk
    - frontend
created_at: 2026-03-24T05:35:24Z
updated_at: 2026-03-24T05:35:24Z
parent: whygraph-ileg
blocked_by:
    - whygraph-m9eh
    - whygraph-h6a8
---

## What to build

Show stale refs in the UI (refs pointing to files that don't exist). Clicking a stale ref opens a modal to enter the updated file path. Submitting calls updateEntity mutation to update the refs field on the node.

## Acceptance criteria

- [ ] Stale refs flagged with visual indicator
- [ ] Click opens correction modal
- [ ] Modal allows entering new file path
- [ ] Submit updates the node's refs via mutation
- [ ] Updated ref clears the stale flag

## User stories addressed

- User story 10, 11
