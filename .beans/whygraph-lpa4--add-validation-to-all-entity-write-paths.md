---
# whygraph-lpa4
title: Add validation to all entity write paths
status: completed
type: task
priority: high
created_at: 2026-03-25T03:55:20Z
updated_at: 2026-03-25T04:59:49Z
parent: whygraph-rqnp
---

Today writeEntity() does not call validateEntity(). GraphQL mutations also skip validation before writing.

Fix: call validateEntity() at all write call sites:
- writeEntity() in entity/writer.ts (or make validation mandatory inside it)
- init command (cli/commands/init.ts)
- interview flow (onboarding/interview.ts)
- GraphQL mutation resolvers (server/schema.ts)

On validation failure: still write the entity (never lose data) but create an issue sidecar.
