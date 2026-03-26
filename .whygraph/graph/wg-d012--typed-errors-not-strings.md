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

## Alternatives

**String errors via throw new Error("message")**: Throw plain errors with string messages. Rejected because the MCP protocol requires error codes and the CLI needs to distinguish user-facing errors from internal failures — string messages can only be parsed with fragile substring matching.

**Error result types (Result<T, E>)**: Return `{ ok: true, value }` or `{ ok: false, error }` union types instead of throwing. Rejected because it requires every call site to check the result, which is verbose for deeply nested operations, and doesn't interoperate naturally with async/await error handling.

**Numeric error codes with a lookup table**: Use numeric codes (e.g., 404, 409) and map them to messages at the boundary. Rejected because numeric codes are opaque during development and debugging, and the MCP SDK accepts named error codes directly.
