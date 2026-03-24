---
# whygraph-bh9g
title: 'Platform rules: Cursor/Copilot/generic instruction files'
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
    - whygraph-sd81
    - whygraph-tphq
---

## What to build

During whygraph init, write platform-specific instruction files based on configured environment. Cursor: .cursor/rules/whygraph.md. Copilot: .github/copilot-instructions.md (append). Generic: .whygraph/AGENT_CONTEXT.md. Content generated from whygraph prime output.

## Acceptance criteria

- [ ] Detects configured platform from init answers
- [ ] Writes appropriate instruction file for Cursor
- [ ] Appends to copilot-instructions.md for Copilot
- [ ] Writes generic agent context file for other platforms
- [ ] Content sourced from prime output

## User stories addressed

- User story 25
