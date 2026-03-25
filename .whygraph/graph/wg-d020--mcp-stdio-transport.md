---
id: wg-d020
label: Decision
title: MCP server uses stdio transport
status: active
date: "2026-03-24"
affects:
  - wg-mcps
  - wg-mcrt
  - wg-mcwt
tags:
  - arch
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

The MCP server needs a transport mechanism to communicate with AI agents. Options are stdio, HTTP SSE, or WebSocket.

## Decision

Use stdio transport for the MCP server. The agent process spawns whygraph as a child process and communicates via stdin/stdout JSON-RPC messages.

## Tradeoffs

Gained: zero network configuration, works in sandboxed environments, natural process lifecycle management. Lost: one MCP server per agent process, cannot share MCP server across multiple agents.
