---
# whygraph-whi8
title: 'Graph projection: entities to graphology MultiDirectedGraph'
status: todo
type: task
priority: critical
tags:
    - afk
    - core
created_at: 2026-03-24T05:32:48Z
updated_at: 2026-03-24T05:32:48Z
parent: whygraph-ileg
blocked_by:
    - whygraph-r198
---

## What to build

Build a graphology MultiDirectedGraph from a collection of parsed entities. Create nodes for each entity. Derive edges: `parent` field creates COMPOSES edges, `affects` creates AFFECTS edges, `supersedes` creates SUPERSEDES edges. Edges only exist when both endpoints are present. Pure function: entities in, graph out.

## Acceptance criteria

- [ ] Creates graph nodes with full entity attributes
- [ ] Derives COMPOSES edges from parent field
- [ ] Derives AFFECTS edges from affects array
- [ ] Derives SUPERSEDES edges from supersedes field
- [ ] Skips edges where endpoint is missing (no throw)
- [ ] Pure function, no side effects

## User stories addressed

- User story 7
