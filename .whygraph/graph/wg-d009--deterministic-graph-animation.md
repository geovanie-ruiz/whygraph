---
id: wg-d009
label: Decision
title: Seeded PRNG for deterministic graph layout
status: active
date: "2026-03-24"
affects:
  - wg-gviz
tags:
  - ux
created_at: "2026-03-24T14:00:00Z"
updated_at: "2026-03-24T14:00:00Z"
---

## Context

D3 force simulations use Math.random() for initial node jitter, producing different layouts on every page load. Users lose spatial memory of where nodes are.

## Decision

Seed both initial positions and D3's internal randomness with a fixed PRNG (mulberry32 + d3.randomLcg). Same seed = same layout every time.

## Tradeoffs

Gained: predictable, repeatable layout — users build spatial memory. Lost: if the seed produces an unfortunate layout for a given graph, there's no natural variation to fix it (must change seed manually).

## Alternatives

**Accept layout non-determinism**: Let D3 use Math.random() and accept that positions change each reload. Rejected because users lose spatial memory of where nodes are, making the visualization feel unstable as the graph grows.

**Server-side layout computation and persistence**: Compute layout on the server and store node positions in entity files or a sidecar. Rejected because it couples visualization concerns to the data layer, pollutes entity files with display metadata, and requires round-trips before rendering.

**Fixed grid or radial manual layout**: Assign nodes to fixed positions based on their type or depth in the hierarchy. Rejected because it requires manual maintenance as the graph grows and produces rigid, non-organic layouts that don't reflect connectivity.
