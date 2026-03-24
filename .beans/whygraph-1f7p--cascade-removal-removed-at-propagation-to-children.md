---
# whygraph-1f7p
title: 'Cascade removal: removed_at propagation to children'
status: completed
type: task
priority: high
tags:
    - afk
    - core
created_at: 2026-03-24T05:32:48Z
updated_at: 2026-03-24T06:12:46Z
parent: whygraph-ileg
blocked_by:
    - whygraph-whi8
---

## What to build

When removed_at is set on a structural node, propagate removal to all COMPOSES children (recursive). Also set removed_at on decisions that only AFFECT removed nodes (fully orphaned). Decisions with some living affects targets keep their status. Pure function: takes entity map + node ID + timestamp, returns list of entities to update.

## Acceptance criteria

- [ ] Recursively finds all COMPOSES descendants
- [ ] Sets removed_at on all descendants
- [ ] Identifies fully orphaned decisions (all affects targets removed)
- [ ] Sets removed_at on orphaned decisions
- [ ] Preserves decisions with partial living affects
- [ ] Returns update list, does not mutate inputs

## User stories addressed

- User story 31
