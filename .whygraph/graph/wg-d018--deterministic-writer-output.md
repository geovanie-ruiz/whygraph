---
id: wg-d018
label: Decision
title: Deterministic entity writer output for stable ETags
status: active
date: "2026-03-24"
affects:
  - wg-wrtr
  - wg-etag
tags:
  - invariant
  - backend
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

ETag-based dirty tracking compares hashes of rendered entity content. If the writer produces different byte output for semantically identical entities, ETags diverge and dirty detection breaks.

## Decision

The entity writer produces deterministic output: sorted YAML keys, consistent quoting, normalized line endings. Same entity data always produces identical bytes.

## Tradeoffs

Gained: reliable ETag comparison, no false dirty flags after rebase. Lost: writer cannot preserve original formatting or key ordering from hand-edited files.
