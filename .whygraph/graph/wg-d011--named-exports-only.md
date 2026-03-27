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
  - arch
created_at: "2026-03-21T18:00:00Z"
updated_at: "2026-03-21T18:00:00Z"
---

## Context

Default exports obscure what is being imported and make refactoring harder. IDEs struggle with auto-import when a module uses default export.

## Decision

All modules use named exports exclusively. No default exports anywhere in the codebase.

## Tradeoffs

Gained: consistent import style, better IDE auto-import, grep-friendly export names. Lost: slightly more verbose for single-export modules, some third-party examples use default exports and must be adapted.

## Alternatives

**Default exports for primary module exports**: Export one thing per module as default, secondary things as named. Rejected because it creates inconsistency — importers have to decide between `import Foo` and `import { Foo }`, IDEs produce inconsistent auto-imports, and renaming requires coordinating both the export name and the import alias.

**Mixed: default for classes, named for functions**: Apply default exports to class-shaped modules only. Rejected because the distinction is arbitrary and hard to enforce; it fragments import style across the codebase without a clear benefit over named exports for everything.
