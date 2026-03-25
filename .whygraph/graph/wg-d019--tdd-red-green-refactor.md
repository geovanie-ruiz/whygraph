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
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

Pure graph functions and entity operations are highly testable. Need a fast test runner that supports ESM and TypeScript natively.

## Decision

Use vitest for all tests. Follow red-green-refactor: write a failing test first, make it pass, then refactor. Tests live alongside source files as *.test.ts.

## Tradeoffs

Gained: fast feedback loop, vitest supports ESM and TS natively, compatible with jest API. Lost: vitest is newer and less battle-tested than jest in some edge cases.
