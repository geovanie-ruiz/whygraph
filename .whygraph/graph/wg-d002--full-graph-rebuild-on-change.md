---
id: wg-d002
label: Decision
title: Full graph rebuild on entity change instead of incremental patching
status: active
date: "2026-03-24"
affects:
  - wg-core
tags:
  - arch
  - performance
created_at: "2026-03-22T18:00:00Z"
updated_at: "2026-03-22T18:00:00Z"
---

## Context

When the file watcher detects a change, the in-memory graph needs to reflect the new state. The graph includes derived edges (COMPOSES from parent, AFFECTS from affects, SUPERSEDES from supersedes). Updating a single entity could affect multiple edges.

## Decision

On any entity add/update/remove, rebuild the entire graphology MultiDirectedGraph from the entity map. No incremental edge patching. The entity map is updated first, then buildGraph is called with all entities.

## Tradeoffs

Gained: correctness is trivial — the graph always matches the entity map exactly. No edge cases around stale edges from removed references. Implementation is 3 lines. Lost: O(n) rebuild on every change. At 10,000 entities this could be noticeable (tens of milliseconds). But for the expected scale (hundreds to low thousands), it's imperceptible.

## Alternatives

- Incremental graph patching (add/remove specific nodes and edges on change) — rejected because tracking which edges need updating when an entity's affects or parent changes is error-prone and the performance gain is unnecessary at current scale.
- Debounced batch rebuild (accumulate changes, rebuild once) — rejected for v1 because the file watcher already debounces at 100ms. Adding another debounce layer adds latency without meaningful benefit.
