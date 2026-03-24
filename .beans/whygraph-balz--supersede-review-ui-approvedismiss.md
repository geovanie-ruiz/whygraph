---
# whygraph-balz
title: 'Supersede review UI: approve/dismiss'
status: completed
type: task
priority: normal
tags:
    - afk
    - frontend
created_at: 2026-03-24T05:35:24Z
updated_at: 2026-03-24T06:45:49Z
parent: whygraph-ileg
blocked_by:
    - whygraph-hy0d
    - whygraph-h6a8
---

## What to build

UI for reviewing supersede candidates. Show pairs of decisions with overlapping affects. Approve action sets the new decision's supersedes field and marks the old one as superseded. Dismiss removes the candidate pair from the list.

## Acceptance criteria

- [ ] Lists supersede candidate pairs
- [ ] Shows shared affected nodes
- [ ] Approve calls updateEntity mutation on both decisions
- [ ] Dismiss removes pair from list
- [ ] List updates live via subscription

## User stories addressed

- User story 9
