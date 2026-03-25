---
id: wg-d017
label: Decision
title: Markdown with YAML frontmatter as entity storage format
status: active
date: "2026-03-24"
affects:
  - wg-pars
  - wg-wrtr
  - wg-ents
tags:
  - arch
  - dx
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

Entities need a file format that is human-readable, git-friendly, and parseable by both the server and AI agents.

## Decision

Use markdown files with YAML frontmatter. Structured data (id, label, refs, affects) goes in frontmatter. Free-form content (context, decision, tradeoffs) goes in the markdown body.

## Tradeoffs

Gained: human-readable in any editor, clean git diffs, AI agents can read/write natively, GitHub renders frontmatter. Lost: YAML parsing edge cases (strings vs numbers, multiline), no schema enforcement without custom validation.
