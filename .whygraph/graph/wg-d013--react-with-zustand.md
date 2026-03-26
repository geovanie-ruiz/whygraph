---
id: wg-d013
label: Decision
title: Zustand for frontend state management
status: active
date: "2026-03-24"
affects:
  - wg-vizf
  - wg-apsh
  - wg-gviz
tags:
  - ux
  - arch
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

The frontend needs shared state for selected node, filter settings, theme, and WebSocket-driven entity updates. React context alone causes unnecessary re-renders.

## Decision

Use Zustand as the single state store. One store with slices for entities, selection, filters, and UI state. Components subscribe to specific slices to minimize re-renders.

## Tradeoffs

Gained: minimal boilerplate, fine-grained subscriptions, works outside React components, tiny bundle. Lost: another dependency, less familiar than Redux for some developers.

## Alternatives

**React Context + useReducer**: Use built-in React primitives for state management. Rejected because context triggers re-renders in all consumers whenever any piece of state changes; the graph visualization and filter panel update at different rates and need isolated subscriptions.

**Redux Toolkit**: Industry-standard state management with devtools and middleware. Rejected because it introduces significant boilerplate (slices, reducers, selectors, dispatch) for a frontend that is essentially a single view with filters. The overhead outweighs the benefits at this scale.

**Jotai / Recoil (atomic state)**: Atom-based state where each piece of state is a separate atom. Rejected because the whygraph store has interconnected state (entities drive the graph which drives selection which drives the detail panel) that benefits from being one store rather than many atoms.
