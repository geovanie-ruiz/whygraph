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
  - data
  - arch
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

ETag-based dirty tracking compares hashes of rendered entity content. If the writer produces different byte output for semantically identical entities, ETags diverge and dirty detection breaks.

## Decision

The entity writer produces deterministic output: sorted YAML keys, consistent quoting, normalized line endings. Same entity data always produces identical bytes.

## Tradeoffs

Gained: reliable ETag comparison, no false dirty flags after rebase. Lost: writer cannot preserve original formatting or key ordering from hand-edited files.

## Alternatives

**Hash entity data fields rather than rendered bytes**: Compute ETags from a canonical JSON serialization of the entity object, not the file content. Rejected because it requires normalizing all field types before hashing; small differences in how fields are parsed (string vs number, array vs undefined) can still produce false divergence. Hashing the rendered output is simpler and more reliable.

**Skip ETag-based dirty tracking entirely**: Treat any file change as a full rebuild. Rejected because with many entities and multiple worktrees, full rebuilds on every change would be slow and would eliminate the ability to detect which worktrees have diverged from the main graph.

**Preserve original formatting, track mutations explicitly**: Store a mutation log alongside entity files to track what changed. Rejected because it duplicates the entity state in a second artifact, creates merge complexity, and the mutation log can drift from the actual file content.
