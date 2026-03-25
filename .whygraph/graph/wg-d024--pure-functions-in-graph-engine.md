---
id: wg-d024
label: Decision
title: Graph engine functions are pure — no side effects
status: active
date: "2026-03-24"
affects:
  - wg-grph
  - wg-prjn
  - wg-tmpr
  - wg-casc
  - wg-sups
tags:
  - arch
  - data
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

Graph operations (projection, temporal filtering, cascade, supersede detection) need to be testable in isolation and composable.

## Decision

All graph engine functions are pure: they take inputs and return outputs with no side effects. No file I/O, no state mutation, no subscriptions. The server core orchestrates by calling pure functions and managing state.

## Tradeoffs

Gained: trivially testable, composable, no hidden dependencies, safe to call from any context. Lost: caller must manage state threading, some operations need multiple function calls instead of one stateful method.
