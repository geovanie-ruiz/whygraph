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
  - frontend
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

The D3 force layout positions nodes organically but the root App node can end up at the edge, making the hierarchy hard to read.

## Decision

Pin the App node (label: App) at the center of the viewport with fixed x/y coordinates. All other nodes float freely around it.

## Tradeoffs

Gained: clear visual hierarchy, stable anchor point for spatial memory. Lost: center area is occupied even if the graph would layout better without it.
