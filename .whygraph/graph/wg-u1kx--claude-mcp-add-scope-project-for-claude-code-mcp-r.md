---
id: wg-u1kx
label: Decision
title: claude mcp add --scope project for claude-code MCP registration
status: active
date: "2026-03-25"
affects:
  - wg-cmdi
  - wg-rulg
tags:
  - integration
  - infra
created_at: "2026-03-25T23:23:20.937Z"
updated_at: "2026-03-25T23:23:20.937Z"
---
## Context

During init, whygraph needs to register its MCP server with the host AI environment. For claude-code, this means getting the whygraph MCP server into Claude Code's known servers list. Two approaches exist: writing directly to .claude/settings.json, or delegating to the claude CLI.

## Decision

Use `claude mcp add --scope project whygraph -- whygraph mcp` via execSync to register the MCP server. This writes to .mcp.json using Claude Code's own mechanism. Fall back to writing .mcp.json directly if the claude CLI is not on PATH.

## Tradeoffs

Gained: uses the official registration path, respects any logic Claude Code applies when adding servers, .mcp.json is the correct project-scoped location. Lost: depends on the claude CLI being available at init time; the fallback path bypasses any validation Claude Code would apply.

## Alternatives

Writing directly to .claude/settings.json — rejected because .claude/settings.json is user-scoped and the wrong location for project MCP servers. The correct project-scoped file is .mcp.json, which claude mcp add --scope project manages.
