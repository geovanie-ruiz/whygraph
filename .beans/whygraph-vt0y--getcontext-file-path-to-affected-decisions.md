---
# whygraph-vt0y
title: 'getContext: file path to affected decisions'
status: completed
type: task
priority: critical
tags:
    - afk
    - core
created_at: 2026-03-24T05:33:12Z
updated_at: 2026-03-24T06:08:35Z
parent: whygraph-ileg
blocked_by:
    - whygraph-whi8
---

## What to build

Given a file path (and optional symbol), find all nodes whose refs include that file, traverse COMPOSES parent chain upward, collect all Decision nodes with AFFECTS edges to any matched node or ancestor. Return matched nodes with parent chains and affected decisions with full attributes.

## Acceptance criteria

- [ ] Matches nodes by exact file path in refs
- [ ] Optional symbol matching (file-level refs always included)
- [ ] Traverses COMPOSES parent chain upward
- [ ] Collects decisions that AFFECT matched nodes or ancestors
- [ ] Returns structured result with nodes and decisions

## User stories addressed

- User story 15
