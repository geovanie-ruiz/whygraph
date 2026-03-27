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
created_at: "2026-03-23T13:00:00Z"
updated_at: "2026-03-23T13:00:00Z"
---

## Context

The MCP server needs a transport mechanism to communicate with AI agents. Options are stdio, HTTP SSE, or WebSocket.

## Decision

Use stdio transport for the MCP server. The agent process spawns whygraph as a child process and communicates via stdin/stdout JSON-RPC messages.

## Tradeoffs

Gained: zero network configuration, works in sandboxed environments, natural process lifecycle management. Lost: one MCP server per agent process, cannot share MCP server across multiple agents.

## Alternatives

**HTTP SSE transport**: MCP server listens on an HTTP port; agent connects via Server-Sent Events. Rejected because it requires the server to be listening before the agent starts, adding a setup step. It also requires network configuration in sandboxed CI environments where port binding may be restricted.

**WebSocket transport**: Persistent bidirectional WebSocket connection for MCP messages. Rejected for the same reasons as HTTP SSE — requires a running server and network access. The MCP SDK supports WebSocket, but the tradeoffs don't favor it for a CLI tool that agents spawn on demand.

**Shared MCP server process**: Run one long-lived MCP server that all agent processes connect to. Rejected because it creates a process management dependency (how does the shared server start? who owns it?). The whygraph server already fills the role of the long-lived process; the MCP server is a separate concern for the agent communication channel.
