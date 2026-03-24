---
# whygraph-lzmh
title: 'GraphQL queries: nodes, decisions, context, gaps, search'
status: in-progress
type: task
priority: high
tags:
    - afk
    - server
created_at: 2026-03-24T05:34:27Z
updated_at: 2026-03-24T06:23:31Z
parent: whygraph-ileg
blocked_by:
    - whygraph-vt0y
    - whygraph-y1l2
    - whygraph-5faf
    - whygraph-c1ea
    - whygraph-fxnn
---

## What to build

Implement GraphQL query resolvers that delegate to graph query functions (getContext, getDecisions, getGaps, listNodes) and server core (getValidationErrors, getSupersedeCandidates, status). Also implement full-text search resolver.

## Acceptance criteria

- [ ] All query resolvers implemented
- [ ] Resolvers delegate to graph query / server core (thin layer)
- [ ] Context query accepts file and optional symbol
- [ ] Decision query accepts filter arguments
- [ ] Search query accepts search string
- [ ] Status query returns server health info

## User stories addressed

- User story 14, 15, 16, 17
