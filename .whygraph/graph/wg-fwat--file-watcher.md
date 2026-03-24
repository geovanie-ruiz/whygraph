---
id: wg-fwat
label: Component
name: File Watcher
status: active
parent: wg-srvr
refs:
  - file: src/server/watcher.ts
created_at: "2026-03-24T02:02:00Z"
updated_at: "2026-03-24T02:02:00Z"
---

Chokidar wrapper that watches .whygraph/graph/ for changes with 100ms debouncing. Emits typed events for downstream consumers.
