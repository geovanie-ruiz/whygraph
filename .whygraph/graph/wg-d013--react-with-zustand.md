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
