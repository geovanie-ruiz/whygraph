---
id: wg-d012
label: Decision
title: Typed error classes instead of string errors
status: active
date: "2026-03-24"
affects:
  - wg-ents
  - wg-vald
  - wg-mcps
tags:
  - arch
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

String-based errors lose structure at catch boundaries. The MCP protocol requires specific error codes, and the CLI needs to distinguish user errors from internal failures.

## Decision

Core functions throw typed error classes extending Error (ValidationError, NotFoundError, ConflictError). CLI catches and formats for humans. MCP catches and maps to protocol error codes.

## Tradeoffs

Gained: structured error handling, each layer formats appropriately, instanceof checks work. Lost: more boilerplate per error type, error class hierarchy to maintain.
