---
# whygraph-lsr4
title: CLI config command
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

Implement `whygraph config` — view current config, update individual settings (tag set, ID prefix, MCP mode, server port). Reads/writes `.whygraph/config.yaml`.

## Acceptance criteria

- [ ] View current config (human-readable and --json)
- [ ] Update individual config fields
- [ ] Validates values before writing
- [ ] Preserves unmodified fields

## User stories addressed

- User story 22
