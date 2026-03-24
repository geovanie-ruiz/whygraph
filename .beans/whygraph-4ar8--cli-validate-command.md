---
# whygraph-4ar8
title: CLI validate command
status: todo
type: task
priority: normal
tags:
    - afk
    - cli
created_at: 2026-03-24T05:33:40Z
updated_at: 2026-03-24T05:33:41Z
parent: whygraph-ileg
blocked_by:
    - whygraph-l4c1
---

## What to build

Implement `whygraph validate` — parse all entity files in .whygraph/graph/, run validation on each, report all errors. Does not require the server. Uses entity store directly.

## Acceptance criteria

- [ ] Walks .whygraph/graph/ and parses all files
- [ ] Validates each entity against schema
- [ ] Reports all errors with file path and details
- [ ] Exits with non-zero code if errors found
- [ ] --json output

## User stories addressed

- User story 26
