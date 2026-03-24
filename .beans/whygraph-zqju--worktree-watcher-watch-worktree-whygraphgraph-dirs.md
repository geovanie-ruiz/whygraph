---
# whygraph-zqju
title: 'Worktree watcher: watch worktree .whygraph/graph/ dirs'
status: completed
type: task
priority: high
tags:
    - afk
    - server
created_at: 2026-03-24T05:36:00Z
updated_at: 2026-03-24T06:33:05Z
parent: whygraph-ileg
blocked_by:
    - whygraph-oq6u
    - whygraph-ewey
---

## What to build

For each detected worktree, start a chokidar watcher on its .whygraph/graph/ directory. Reuse the same debouncing and event pattern as the main watcher. Merge worktree entity changes into the main server's in-memory state as "dirty" — visible but not persisted to main repo disk.

## Acceptance criteria

- [ ] Watches each worktree's .whygraph/graph/
- [ ] Same debounce and event pattern as main watcher
- [ ] Worktree entities merged into main state as dirty
- [ ] Multiple worktrees watched simultaneously
- [ ] Clean shutdown removes watchers

## User stories addressed

- User story 19
