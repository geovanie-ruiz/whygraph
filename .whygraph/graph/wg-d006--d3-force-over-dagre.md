---
id: wg-d006
label: Decision
title: D3 force layout over dagre/ELK
status: active
date: "2026-03-24"
affects:
  - wg-gviz
  - wg-vizf
tags:
  - arch
  - ux
created_at: "2026-03-23T21:00:00Z"
updated_at: "2026-03-23T21:00:00Z"
---

## Context

The graph visualization needs a layout algorithm. Options: D3 force-directed, dagre (hierarchical), or ELK (layered).

## Decision

Use D3 force-directed layout with deterministic seeding. Gives organic, explorable layouts without imposing artificial hierarchy. Runs synchronously for instant rendering.

## Tradeoffs

Gained: natural clustering by connectivity, smooth animation possible, zero extra dependencies (D3 already used). Lost: no guaranteed top-down hierarchy, node positions vary with graph topology changes.

## Alternatives

**dagre**: Produces clean top-down hierarchical layouts, well-suited for tree-shaped graphs. Rejected because the whygraph structure is not a pure tree — decisions cross feature and component boundaries with AFFECTS edges, which dagre cannot express without distorting the layout. Also adds a dependency.

**ELK (Eclipse Layout Kernel)**: Powerful layered graph layout engine with many algorithms. Rejected because it requires a Java or WebAssembly runtime, adds significant bundle weight, and is more complex to integrate than the problem warrants at this scale.

**Manual positioning**: Let users drag and persist node positions. Rejected because it requires a position storage layer and breaks when new nodes are added, shifting everything else.
