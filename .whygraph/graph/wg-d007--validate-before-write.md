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
  - invariant
created_at: "2026-03-24T14:00:00Z"
updated_at: "2026-03-24T14:00:00Z"
---

## Context

Entity files are the source of truth. Invalid frontmatter (missing required fields, broken refs) would corrupt the graph silently.

## Decision

Run full validation before every write operation. Never skip validation, even for internal callers.

## Tradeoffs

Gained: graph state is always valid on disk, bugs surface at write time not read time. Lost: small performance cost per write, validation logic must stay in sync with schema.
