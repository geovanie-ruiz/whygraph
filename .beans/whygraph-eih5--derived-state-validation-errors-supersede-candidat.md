---
# whygraph-eih5
title: 'Derived state: validation errors + supersede candidates'
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
    - whygraph-hy0d
    - whygraph-8l5e
---

## What to build

Compute and hold in memory: validation errors from entity parsing, supersede candidates from overlapping affects. Recompute on entity changes. Expose via server core methods for API consumers.

## Acceptance criteria

- [ ] Holds validation errors per entity
- [ ] Holds supersede candidate pairs
- [ ] Recomputes incrementally on changes
- [ ] Exposes via getValidationErrors(), getSupersedeCandidates()

## User stories addressed

- User story 28
