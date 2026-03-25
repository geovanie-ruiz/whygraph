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
  - frontend
created_at: "2026-03-24T14:00:00Z"
updated_at: "2026-03-24T14:00:00Z"
---

## Context

The graph visualization needs a layout algorithm. Options: D3 force-directed, dagre (hierarchical), or ELK (layered).

## Decision

Use D3 force-directed layout with deterministic seeding. Gives organic, explorable layouts without imposing artificial hierarchy. Runs synchronously for instant rendering.

## Tradeoffs

Gained: natural clustering by connectivity, smooth animation possible, zero extra dependencies (D3 already used). Lost: no guaranteed top-down hierarchy, node positions vary with graph topology changes.
