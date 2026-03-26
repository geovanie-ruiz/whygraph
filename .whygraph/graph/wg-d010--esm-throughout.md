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
  - arch
created_at: "2026-03-24T14:00:00Z"
updated_at: "2026-03-24T14:00:00Z"
---

## Context

Node.js supports both CJS and ESM. Mixing them causes interop issues with imports, __dirname, and dynamic require.

## Decision

ESM everywhere. All TypeScript source uses .js extensions on imports. Package.json has "type": "module".

## Tradeoffs

Gained: consistent module system, works with modern tooling and top-level await. Lost: some older npm packages need import workarounds, .js extensions in TS source look odd to newcomers.

## Alternatives

**CommonJS throughout**: Use require() and module.exports with "type": "commonjs". Rejected because major dependencies (nanoid, graphology) are now ESM-only or have degraded CJS support, and CJS interop with ESM packages requires workarounds that obscure intent.

**Dual CJS/ESM output**: Compile to both formats for maximum compatibility. Rejected because whygraph is a CLI tool, not a library — downstream consumers don't need dual format, and dual builds add complexity without benefit.

**ts-node / tsx at runtime**: Skip compilation and run TypeScript directly with ts-node or tsx. Rejected because it requires a dev-time dependency in production and adds startup overhead; the CLI ships as compiled JavaScript.
