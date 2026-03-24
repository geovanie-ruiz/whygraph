---
# whygraph-ewey
title: 'Worktree detection: find git worktrees with .whygraph/'
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
    - whygraph-8l5e
---

## What to build

Detect git worktrees that contain a .whygraph/graph/ directory. Parse `git worktree list --porcelain` output. Return list of worktree paths that have whygraph entity files. Called on server startup and periodically or on git events.

## Acceptance criteria

- [ ] Parses git worktree list output
- [ ] Filters for worktrees with .whygraph/graph/
- [ ] Returns worktree paths and branch names
- [ ] Handles no worktrees gracefully
- [ ] Handles detached HEAD worktrees

## User stories addressed

- User story 18
