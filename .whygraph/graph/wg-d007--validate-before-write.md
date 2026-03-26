---
id: wg-d007
label: Decision
title: Validate before every entity write
status: active
date: "2026-03-24"
affects:
  - wg-vald
  - wg-ents
tags:
  - data
created_at: "2026-03-24T14:00:00Z"
updated_at: "2026-03-24T14:00:00Z"
---

## Context

Entity files are the source of truth. Invalid frontmatter (missing required fields, broken refs) would corrupt the graph silently.

## Decision

Run full validation before every write operation. Never skip validation, even for internal callers.

## Tradeoffs

Gained: graph state is always valid on disk, bugs surface at write time not read time. Lost: small performance cost per write, validation logic must stay in sync with schema.

## Alternatives

**Validate on read only**: Parse and validate when the server loads entities, not on write. Rejected because invalid files silently accumulate on disk and validation errors surface far from the write that caused them, making debugging harder.

**Validate asynchronously via file watcher**: Write the file and let the file watcher validate afterward, creating a sidecar issue if problems are found. This is the fallback path (agents writing files directly), but it is not acceptable for code paths that go through the writer API where synchronous rejection is possible.

**Schema-enforced at the TypeScript type level only**: Rely on TypeScript types to prevent invalid entities at compile time. Rejected because agents and external tools write files directly, bypassing TypeScript entirely.
