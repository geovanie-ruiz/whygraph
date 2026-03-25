---
id: wg-d010
label: Decision
title: ESM throughout with .js extensions
status: active
date: "2026-03-24"
affects:
  - wg-clis
  - wg-srvr
  - wg-vizf
tags:
  - convention
created_at: "2026-03-24T14:00:00Z"
updated_at: "2026-03-24T14:00:00Z"
---

## Context

Node.js supports both CJS and ESM. Mixing them causes interop issues with imports, __dirname, and dynamic require.

## Decision

ESM everywhere. All TypeScript source uses .js extensions on imports. Package.json has "type": "module".

## Tradeoffs

Gained: consistent module system, works with modern tooling and top-level await. Lost: some older npm packages need import workarounds, .js extensions in TS source look odd to newcomers.
