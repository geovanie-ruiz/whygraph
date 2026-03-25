---
# whygraph-m4y4
title: Issue sidecar system for entity validation problems
status: todo
type: task
priority: high
created_at: 2026-03-25T03:55:20Z
updated_at: 2026-03-25T03:55:20Z
parent: whygraph-rqnp
---

New system: .whygraph/issues/<entity-id>.json

Three tiers:
1. Parseable + valid → clean ingestion, no sidecar
2. Parseable + invalid (bad refs, missing fields) → ingest entity, create issue sidecar
3. Unparseable (corrupted YAML) → flag file as corrupted, preserve raw file on disk

Lifecycle:
- On server startup: load all entities, load all issues, validate every entity. Create/update/delete sidecars to match current state.
- On file watcher event: validate the changed entity only. Create/update/delete its sidecar.
- Dangling issues (entity no longer exists or now passes) → delete sidecar.

Expose issues via GraphQL so frontend can display warnings on affected nodes.
