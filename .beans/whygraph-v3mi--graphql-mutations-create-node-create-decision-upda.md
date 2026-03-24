---
# whygraph-v3mi
title: 'GraphQL mutations: create node, create decision, update'
status: completed
type: task
priority: high
tags:
    - afk
    - server
created_at: 2026-03-24T05:34:27Z
updated_at: 2026-03-24T06:33:05Z
parent: whygraph-ileg
blocked_by:
    - whygraph-addb
    - whygraph-fxnn
---

## What to build

Implement GraphQL mutation resolvers: createNode (write structural node file), createDecision (write decision file), updateEntity (modify front matter — status, removed_at, refs). Use entity writer for file I/O. Validate before writing. Return created/updated entity.

## Acceptance criteria

- [ ] createNode writes a structural node file
- [ ] createDecision writes a decision file
- [ ] updateEntity modifies front matter fields
- [ ] All mutations validate before writing
- [ ] Return the created/updated entity

## User stories addressed

- User story 13, 21
