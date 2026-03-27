---
id: wg-fwat
label: Component
name: File Watcher
status: active
parent: wg-srvr
refs:
  - file: src/server/watcher.ts
created_at: "2026-03-22T09:00:00Z"
updated_at: "2026-03-22T09:00:00Z"
---

Chokidar wrapper that watches .whygraph/graph/ for changes with 100ms debouncing. Emits typed events for downstream consumers.
