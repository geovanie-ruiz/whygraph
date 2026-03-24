---
# whygraph-8l5e
title: 'Server core: in-memory entity map + graph'
status: completed
type: task
priority: critical
tags:
    - afk
    - server
created_at: 2026-03-24T05:34:05Z
updated_at: 2026-03-24T06:12:17Z
parent: whygraph-ileg
blocked_by:
    - whygraph-r198
    - whygraph-whi8
---

## What to build

The composition root. On startup: use entity parser to walk .whygraph/graph/ and load all entity files into a Map<string, Entity>. Build the graphology graph using graph projection. Expose the entity map and graph for downstream consumers. Provide methods: getEntity(id), getAllEntities(), getGraph().

## Acceptance criteria

- [ ] Walks directory and parses all .md files
- [ ] Builds in-memory entity map
- [ ] Builds graphology graph from entities
- [ ] Exposes entity map and graph via methods
- [ ] Handles empty directory gracefully
- [ ] Logs parse errors without crashing

## User stories addressed

- User story 4
