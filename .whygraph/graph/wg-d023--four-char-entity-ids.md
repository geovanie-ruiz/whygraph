---
id: wg-d023
label: Decision
title: Four-character entity IDs with wg- prefix
status: active
date: "2026-03-24"
affects:
  - wg-idgn
  - wg-ents
tags:
  - arch
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

Entity IDs appear in frontmatter, affects arrays, and file names. They need to be short enough to type, unique enough to avoid collisions, and human-readable enough to recognize.

## Decision

Use wg- prefix followed by 4 lowercase alphanumeric characters (e.g., wg-grph, wg-vizf). Decisions use wg-d followed by a 3-digit sequence number. The ID generator checks for collisions against the entity map.

## Tradeoffs

Gained: compact IDs that fit in affects arrays, recognizable at a glance, easy to type. Lost: limited namespace (36^4 = 1.6M combinations), sequence numbers for decisions couple to creation order.

## Alternatives

**Full UUIDs or NanoIDs (21 chars)**: Use globally unique random identifiers. Rejected because IDs appear frequently in frontmatter affects arrays and file names. Long IDs make files harder to read, harder to type, and produce cluttered diffs. Collision probability at the scale of a single project's entity graph is negligible with 4 characters.

**Sequential numeric IDs** (1, 2, 3, ...): Auto-increment IDs from a counter file. Rejected because it requires a centralized counter that creates merge conflicts in multi-agent/multi-worktree scenarios. Random character IDs allow concurrent agents to generate non-colliding IDs without coordination.

**File path as the identifier**: Use the filename (without extension) as the entity ID. Rejected because it couples the ID to the file name, making rename operations break all references. A separate ID field decouples identity from storage location.
