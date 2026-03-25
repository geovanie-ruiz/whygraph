---
id: wg-d011
label: Decision
title: Named exports only — no default exports
status: active
date: "2026-03-24"
affects:
  - wg-clis
  - wg-srvr
  - wg-vizf
tags:
  - convention
created_at: "2026-03-24T15:00:00Z"
updated_at: "2026-03-24T15:00:00Z"
---

## Context

Default exports obscure what is being imported and make refactoring harder. IDEs struggle with auto-import when a module uses default export.

## Decision

All modules use named exports exclusively. No default exports anywhere in the codebase.

## Tradeoffs

Gained: consistent import style, better IDE auto-import, grep-friendly export names. Lost: slightly more verbose for single-export modules, some third-party examples use default exports and must be adapted.
