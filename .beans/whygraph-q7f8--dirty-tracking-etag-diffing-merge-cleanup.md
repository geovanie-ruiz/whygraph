---
# whygraph-q7f8
title: 'Dirty tracking: ETag diffing + merge cleanup'
status: todo
type: task
priority: high
tags:
    - afk
    - server
created_at: 2026-03-24T05:36:00Z
updated_at: 2026-03-24T05:36:00Z
parent: whygraph-ileg
blocked_by:
    - whygraph-zqju
---

## What to build

ETag-based diffing between worktree and main entity versions. When a worktree entity matches the main version (e.g., after rebase/merge), clear the dirty flag and worktree link. When the worktree branch merges to main, the main file watcher picks up the new files and dirty flags clear naturally.

## Acceptance criteria

- [ ] ETag computed from rendered entity content
- [ ] Worktree entities compared against main versions
- [ ] Matching ETags clear dirty flag
- [ ] Post-merge: main watcher picks up new files, dirty clears
- [ ] Dirty entities visually distinguishable in API responses

## User stories addressed

- User story 19, 20
