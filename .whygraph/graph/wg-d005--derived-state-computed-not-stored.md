---
id: wg-d005
label: Decision
title: Derived state (validation errors, supersede candidates) computed on demand, not persisted
status: active
date: "2026-03-24"
affects:
  - wg-srvr
  - wg-core
tags:
  - data
  - arch
created_at: "2026-03-23T19:00:00Z"
updated_at: "2026-03-23T19:00:00Z"
---

## Context

Validation errors and supersede candidates are useful for the UI and API, but they're derived from entity state. The POC stored these in separate JSONL files (reviews.jsonl, errors.jsonl) which were gitignored and lost in worktrees.

## Decision

Compute derived state in memory from the entity map on demand. Validation errors are produced by running validateEntity on each entity. Supersede candidates are detected by checking for overlapping affects arrays between active decisions. Neither is persisted to disk. If the server restarts, they're recomputed from the entity files.

## Tradeoffs

Gained: zero gitignored critical state. Nothing to lose in worktrees. Always consistent with current entity state (no stale cache). Lost: recomputation cost on every query. But validation and supersede detection are O(n) and O(n^2) respectively — fast enough for expected entity counts.

## Alternatives

- Persist to files like the POC (reviews.jsonl, errors.jsonl) — rejected because this was the exact failure mode that broke worktree support. Gitignored state files don't replicate.
- Cache with invalidation — rejected for v1 because the computation is cheap enough to not need caching. Can add later if profiling shows a bottleneck.
