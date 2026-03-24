---
id: wg-core
label: Component
name: Server Core
status: active
parent: wg-srvr
refs:
  - file: src/server/core.ts
created_at: "2026-03-24T02:00:00Z"
updated_at: "2026-03-24T02:00:00Z"
---

Composition root holding the in-memory entity map and graphology graph. Loads from disk on startup, supports incremental updates.
