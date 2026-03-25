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
