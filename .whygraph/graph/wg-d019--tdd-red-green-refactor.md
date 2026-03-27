---
id: wg-d019
label: Decision
title: TDD with vitest — red-green-refactor
status: active
date: "2026-03-24"
affects:
  - wg-grph
  - wg-ents
  - wg-srvr
tags:
  - arch
  - integration
created_at: "2026-03-22T14:00:00Z"
updated_at: "2026-03-22T14:00:00Z"
---

## Context

Pure graph functions and entity operations are highly testable. Need a fast test runner that supports ESM and TypeScript natively.

## Decision

Use vitest for all tests. Follow red-green-refactor: write a failing test first, make it pass, then refactor. Tests live alongside source files as *.test.ts.

## Tradeoffs

Gained: fast feedback loop, vitest supports ESM and TS natively, compatible with jest API. Lost: vitest is newer and less battle-tested than jest in some edge cases.

## Alternatives

**Jest**: The dominant Node.js test runner with a large ecosystem. Rejected because Jest requires additional configuration (babel or ts-jest, experimental VM modules) to handle ESM and TypeScript, whereas vitest works with the project's existing tsconfig without modification. The jest-compatible API means the switch has no learning cost.

**Node.js built-in test runner (node:test)**: Available since Node 18, zero dependencies. Rejected because it lacks vitest's watch mode, coverage integration, and UI-friendly reporting. The DX gap is significant for a project following TDD.

**Write-tests-after approach**: Write code first, add tests after features are complete. Rejected because the graph engine and entity operations are pure functions that are easiest to specify before implementation. TDD on pure functions produces better API design by forcing the author to think about inputs and outputs before writing logic.
