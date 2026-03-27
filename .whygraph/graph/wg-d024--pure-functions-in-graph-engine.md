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
created_at: "2026-03-22T16:00:00Z"
updated_at: "2026-03-22T16:00:00Z"
---

## Context

Graph operations (projection, temporal filtering, cascade, supersede detection) need to be testable in isolation and composable.

## Decision

All graph engine functions are pure: they take inputs and return outputs with no side effects. No file I/O, no state mutation, no subscriptions. The server core orchestrates by calling pure functions and managing state.

## Tradeoffs

Gained: trivially testable, composable, no hidden dependencies, safe to call from any context. Lost: caller must manage state threading, some operations need multiple function calls instead of one stateful method.

## Alternatives

**Stateful graph engine class with internal state**: A `GraphEngine` class that owns the graphology instance and exposes methods that mutate it. Rejected because stateful methods are harder to test in isolation — each test requires setting up object state before calling methods. Unit tests for pure functions are a `const result = fn(input)` call with no setup.

**Reactive graph engine using observables**: Express graph operations as RxJS observables that react to file change events. Rejected because it adds RxJS as a dependency, requires learning the observable mental model throughout the codebase, and obscures the flow of data for a problem that is simpler than reactive streams.

**GraphQL resolvers read from disk directly**: Skip the in-memory graph and have each resolver read entity files on demand. Rejected because it produces O(n) disk reads per query and makes graph traversal (finding all decisions that affect a node) extremely expensive without index structures that duplicate what graphology already provides.
