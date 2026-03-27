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
  - arch
  - integration
created_at: "2026-03-23T09:00:00Z"
updated_at: "2026-03-23T09:00:00Z"
---

## Context

The CLI is used interactively by humans and programmatically by scripts and AI agents. Human-friendly output (colors, tables) breaks when piped to jq or parsed by agents.

## Decision

Every CLI command accepts a --json flag that switches output to structured JSON on stdout. Human-formatted output is the default. Errors in JSON mode are also JSON-formatted.

## Tradeoffs

Gained: reliable scripting and AI agent integration, consistent contract across all commands. Lost: every command needs dual output paths, JSON output must be maintained alongside human output.

## Alternatives

**Exit code only, no structured output**: Let scripts check exit codes for pass/fail without parsing output. Rejected because agents and scripts need more than a success/failure signal — they need counts, entity IDs, and error details to take follow-up actions.

**Separate subcommands for machine output** (e.g., `whygraph issues --format json`): Use a `--format` flag with multiple options. Rejected because `--json` is simpler to type and consistent with established CLI conventions (gh CLI, kubectl use `--json` or `-o json`); more formats would be added only if a concrete need arises.

**GraphQL API only, no CLI JSON output**: Require scripts to query the GraphQL endpoint directly for structured data. Rejected because it requires the server to be running; the CLI must work offline for commands like `validate` and `issues`.
