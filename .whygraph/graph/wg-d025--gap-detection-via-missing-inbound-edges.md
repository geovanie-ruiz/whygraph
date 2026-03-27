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
created_at: "2026-03-22T18:00:00Z"
updated_at: "2026-03-22T18:00:00Z"
---

## Context

Architecture gaps are areas where code exists but no decision explains why it was built that way. Need a way to surface these automatically.

## Decision

A component or feature with zero inbound AFFECTS edges from any decision is considered a gap. The gap detector scans all non-decision entities and returns those with no decision coverage. The frontend highlights these in the graph view.

## Tradeoffs

Gained: automatic gap surfacing, visual feedback encourages decision capture. Lost: false positives for trivially obvious components that don't need a decision, no severity ranking.

## Alternatives

**Manual gap marking**: Let developers tag nodes as `coverage: none` to explicitly declare they have no decisions yet. Rejected because it requires manual maintenance and defeats the purpose of automatic gap detection — the point is to surface what developers forgot, not what they marked.

**Heuristic-based gap scoring**: Score gap severity by how many lines of code reference the component, how recently it was modified, or how many tests cover it. Rejected for v1 because it requires parsing the codebase, which is outside whygraph's scope. The simple binary (has decisions / doesn't have decisions) is sufficient to drive behavior.

**Track gaps as entity records**: Create explicit Gap entities in the graph when no decision covers a node. Rejected because gaps are a derived property of the graph topology, not first-class entities. Storing them as records creates synchronization work (creating and deleting gap entities as decisions are added/removed) that is better handled by a query at render time.
