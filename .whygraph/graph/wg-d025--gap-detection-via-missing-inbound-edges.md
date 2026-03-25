---
id: wg-d025
label: Decision
title: Gap detection via missing inbound decision edges
status: active
date: "2026-03-24"
affects:
  - wg-gaps
  - wg-gphg
tags:
  - arch
  - ux
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

Architecture gaps are areas where code exists but no decision explains why it was built that way. Need a way to surface these automatically.

## Decision

A component or feature with zero inbound AFFECTS edges from any decision is considered a gap. The gap detector scans all non-decision entities and returns those with no decision coverage. The frontend highlights these in the graph view.

## Tradeoffs

Gained: automatic gap surfacing, visual feedback encourages decision capture. Lost: false positives for trivially obvious components that don't need a decision, no severity ranking.
