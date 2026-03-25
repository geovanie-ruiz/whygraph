---
id: wg-d008
label: Decision
title: Graphology is the graph — no parallel structures
status: active
date: "2026-03-24"
affects:
  - wg-grph
  - wg-prjn
  - wg-core
tags:
  - arch
created_at: "2026-03-24T14:00:00Z"
updated_at: "2026-03-24T14:00:00Z"
---

## Context

The server needs an in-memory graph for queries, traversals, and projections. Could build a custom adjacency structure or use a library.

## Decision

Use graphology as the single in-memory graph representation. All graph operations go through graphology's API. No parallel data structures (adjacency lists, index maps) that could drift.

## Tradeoffs

Gained: battle-tested traversal/query primitives, single source of truth for graph topology, rich plugin ecosystem. Lost: dependency on graphology's API surface, must project entities into graphology format on every update.
