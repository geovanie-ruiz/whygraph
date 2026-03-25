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
