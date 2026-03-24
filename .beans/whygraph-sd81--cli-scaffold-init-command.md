---
# whygraph-sd81
title: CLI scaffold + init command
status: todo
type: task
priority: critical
tags:
    - afk
    - cli
created_at: 2026-03-24T05:33:40Z
updated_at: 2026-03-24T05:33:41Z
parent: whygraph-ileg
blocked_by:
    - whygraph-addb
    - whygraph-l4c1
---

## What to build

Set up the CLI with commander. Implement `whygraph init` — prompts for app name, environment, creates `.whygraph/` directory, `config.yaml`, and an App node file in `.whygraph/graph/`. Supports --json output.

## Acceptance criteria

- [ ] CLI scaffold with commander, named exports, ESM
- [ ] `whygraph init` creates .whygraph/ directory structure
- [ ] Creates config.yaml with defaults
- [ ] Creates App node file in .whygraph/graph/
- [ ] Interactive prompts for app name, environment
- [ ] --json flag for programmatic output

## User stories addressed

- User story 1
