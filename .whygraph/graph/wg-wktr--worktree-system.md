---
id: wg-wktr
label: Component
name: Worktree System
status: active
parent: wg-srvr
refs:
  - file: src/server/worktree.ts
  - file: src/server/worktree-watcher.ts
  - file: src/server/etag.ts
created_at: "2026-03-24T02:04:00Z"
updated_at: "2026-03-24T02:04:00Z"
---

Detects git worktrees, watches their .whygraph/graph/ directories, tracks dirty state via ETag diffing.
