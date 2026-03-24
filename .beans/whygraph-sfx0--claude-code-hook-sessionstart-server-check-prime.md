---
# whygraph-sfx0
title: 'Claude Code hook: SessionStart server check + prime'
status: todo
type: task
priority: normal
tags:
    - afk
    - platform
created_at: 2026-03-24T05:36:00Z
updated_at: 2026-03-24T05:36:00Z
parent: whygraph-ileg
blocked_by:
    - whygraph-tphq
    - whygraph-sauw
---

## What to build

Claude Code SessionStart hook that checks if whygraph server is running (health check on configured port). If not running, prompts user to start it. Also outputs whygraph prime content. Configure in .claude/settings.json during whygraph init.

## Acceptance criteria

- [ ] Hook checks server health endpoint
- [ ] Prompts user to start server if not running
- [ ] Outputs prime content into session context
- [ ] Configured automatically by whygraph init (Claude Code environment)
- [ ] No-op if .whygraph/ doesn't exist

## User stories addressed

- User story 24
