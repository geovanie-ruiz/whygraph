---
id: wg-y9ze
label: Decision
title: MCP_SETUP.md fallback when auto-registration fails
status: active
date: "2026-03-25"
affects:
  - wg-cmdi
  - wg-rulg
tags:
  - ux
  - integration
created_at: "2026-03-25T23:23:28.012Z"
updated_at: "2026-03-25T23:23:28.012Z"
---
## Context

MCP registration during init can fail — the claude CLI may not be present, .cursor/mcp.json may not be writable, or the environment may be "other" with no known registration mechanism. The user needs to know how to complete setup manually without digging through docs.

## Decision

When auto-registration fails, write .whygraph/MCP_SETUP.md with environment-specific instructions and surface the path in the CLI output. The "other" environment always writes MCP_SETUP.md since no auto-registration is possible.

## Tradeoffs

Gained: user always has a clear next step regardless of failure mode, instructions are environment-specific and co-located with the project. Lost: MCP_SETUP.md is only useful once and becomes stale noise after setup is complete.

## Alternatives

Printing instructions directly to stdout — rejected because long multi-line instructions in terminal output get lost in scroll. A file the user can open is more actionable. Embedding instructions in AGENTS.md — rejected because setup instructions are one-time human concerns, not agent-facing guidance that should load on every prompt.
