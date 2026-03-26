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

## Alternatives

**Custom adjacency structure**: Build a plain adjacency list (Map of node ID → neighbors) alongside entity maps. Rejected because it duplicates graph topology in a second structure that can drift from the entity state, and reinvents traversal primitives that graphology already provides.

**NetworkX-style in-process graph in a side database (e.g., SQLite)**: Store the graph in SQLite for persistence and querying. Rejected because it adds a database dependency, requires SQL for graph traversals (poorly suited to graph topology queries), and the graph fits comfortably in memory.

**vis-network or cytoscape.js**: Frontend-oriented graph libraries that include both layout and data structure. Rejected because they are browser-only and bundle both visualization and data concerns together; the server needs a graph structure without a rendering layer.
