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
  - integration
created_at: "2026-03-20T14:00:00Z"
updated_at: "2026-03-20T14:00:00Z"
---

## Context

Entities need a file format that is human-readable, git-friendly, and parseable by both the server and AI agents.

## Decision

Use markdown files with YAML frontmatter. Structured data (id, label, refs, affects) goes in frontmatter. Free-form content (context, decision, tradeoffs) goes in the markdown body.

## Tradeoffs

Gained: human-readable in any editor, clean git diffs, AI agents can read/write natively, GitHub renders frontmatter. Lost: YAML parsing edge cases (strings vs numbers, multiline), no schema enforcement without custom validation.

## Alternatives

**JSON files**: Store entities as `.json` files with no markdown body. Rejected because free-form decision content (context, tradeoffs, alternatives) benefits from markdown formatting. JSON also produces harder-to-read diffs and is unpleasant to hand-edit.

**TOML**: TOML frontmatter with a markdown body (similar to Hugo). Rejected because TOML is less familiar to developers than YAML, and the gray-matter parsing library has first-class YAML support that covers the whygraph schema without issues.

**Plain markdown with structured headings**: No frontmatter — parse IDs, tags, and relationships from heading structure and in-body conventions. Rejected because parsing structured data from free-form headings is fragile. Frontmatter provides a clear, parseable boundary between metadata and human content.
