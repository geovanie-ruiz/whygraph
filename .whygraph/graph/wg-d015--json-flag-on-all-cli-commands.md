---
id: wg-d015
label: Decision
title: All CLI commands accept --json for programmatic output
status: active
date: "2026-03-24"
affects:
  - wg-clis
  - wg-cmdi
  - wg-cmds
  - wg-cmdp
tags:
  - convention
  - dx
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

The CLI is used interactively by humans and programmatically by scripts and AI agents. Human-friendly output (colors, tables) breaks when piped to jq or parsed by agents.

## Decision

Every CLI command accepts a --json flag that switches output to structured JSON on stdout. Human-formatted output is the default. Errors in JSON mode are also JSON-formatted.

## Tradeoffs

Gained: reliable scripting and AI agent integration, consistent contract across all commands. Lost: every command needs dual output paths, JSON output must be maintained alongside human output.
