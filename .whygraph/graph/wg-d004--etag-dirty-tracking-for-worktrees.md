---
id: wg-d004
label: Decision
title: ETag-based dirty tracking for worktree entity diffing
status: active
date: "2026-03-24"
affects:
  - wg-wktr
tags:
  - data
  - arch
created_at: "2026-03-23T17:00:00Z"
updated_at: "2026-03-23T17:00:00Z"
---

## Context

When a worktree agent modifies a decision file, the server needs to know whether the worktree version differs from the main branch version. After a merge/rebase, the worktree version might match main again, and the dirty flag should clear automatically.

## Decision

Compute FNV-1a hash (ETag) of each entity's rendered markdown content. Compare worktree entity ETags against main entity ETags. If they match, the entity is not dirty. If they differ, mark it dirty. On file watcher events, recompute and compare.

## Tradeoffs

Gained: automatic dirty detection without tracking git operations. After rebase/merge, ETags naturally converge and dirty flags clear. Cheap to compute (FNV-1a is fast). Lost: hash collisions are theoretically possible (FNV-1a is not cryptographic), though practically impossible for entity-sized content. Requires rendering the entity to compute the hash, which means the writer's output must be deterministic.

## Alternatives

- Git diff-based detection (run git diff between worktree and main) — rejected because it requires shelling out to git on every check, which is slower and more complex than in-process hash comparison.
- Timestamp-based (compare mtime) — rejected because file system timestamps are unreliable across systems and can change without content changing (touch, copy).
- No dirty tracking (treat all worktree entities as dirty) — rejected because it would pollute the main graph with duplicate entities after merge.
