---
id: wg-d022
label: Decision
title: App node pinned at graph center
status: active
date: "2026-03-24"
affects:
  - wg-gviz
  - wg-prjn
tags:
  - ux
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

The D3 force layout positions nodes organically but the root App node can end up at the edge, making the hierarchy hard to read.

## Decision

Pin the App node (label: App) at the center of the viewport with fixed x/y coordinates. All other nodes float freely around it.

## Tradeoffs

Gained: clear visual hierarchy, stable anchor point for spatial memory. Lost: center area is occupied even if the graph would layout better without it.

## Alternatives

**Let the App node float freely with the force simulation**: Apply no special position constraints to any node. Rejected because the App node naturally ends up wherever the force simulation pushes it, often at the periphery or middle of a cluster, which makes the hierarchy unclear. Users lose the visual anchor that tells them "this is the root."

**Pin the App node but allow user repositioning**: Let users drag the App node to reposition it. Rejected for v1 because persisting the pinned position requires a storage mechanism. The default center pin works for all graph sizes without any state management.

**Use a hierarchical layout with App at the top**: Switch to a top-down layout (e.g., dagre) with the App node at the top. Rejected because the graph is not a pure hierarchy — AFFECTS edges from decisions cross multiple branches, making a strict top-down layout misleading. The center pin gives a clear root without forcing a tree structure.
