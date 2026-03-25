---
# whygraph-7fau
title: Normalize canonical tag list and fix generated entities
status: completed
type: task
priority: normal
created_at: 2026-03-25T03:55:20Z
updated_at: 2026-03-25T04:53:56Z
parent: whygraph-rqnp
---

Canonical tag list: arch, data, security, performance, integration, infra, ux

This list must be:
- Defined in one place (types.ts or config)
- Enforced in validation (backend rejects unknown tags)
- Hardcoded in TagFilter.tsx (frontend)
- Included in CLAUDE.md/AGENTS.md instructions

Fix the ~57 generated entity files in .whygraph/graph/ that use non-canonical tags (frontend, backend, convention, invariant, perf, dx) — remap to canonical equivalents.
