---
# whygraph-tphq
title: CLI prime command
status: todo
type: task
priority: high
tags:
    - afk
    - cli
created_at: 2026-03-24T05:33:40Z
updated_at: 2026-03-24T05:33:41Z
parent: whygraph-ileg
blocked_by:
    - whygraph-sd81
---

## What to build

Implement `whygraph prime` — output agent instructions to stdout. Includes the decision capture directive, file format reference, recognition heuristic summary, and a directive to verify the whygraph server is running. Content generated dynamically from config (prefix, tag set).

## Acceptance criteria

- [ ] Outputs decision capture instructions to stdout
- [ ] Includes server verification directive
- [ ] Dynamically renders config values (prefix, tags)
- [ ] Suitable for piping into hooks or files

## User stories addressed

- User story 23
