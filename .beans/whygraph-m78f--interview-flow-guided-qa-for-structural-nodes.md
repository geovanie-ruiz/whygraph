---
# whygraph-m78f
title: 'Interview flow: guided Q&A for structural nodes'
status: todo
type: task
priority: normal
tags:
    - afk
    - cli
created_at: 2026-03-24T05:36:00Z
updated_at: 2026-03-24T05:36:00Z
parent: whygraph-ileg
blocked_by:
    - whygraph-sd81
    - whygraph-5faf
---

## What to build

Interactive CLI flow (or skill) that walks the developer through their architecture. Asks: "What are your major features?", "What components does X have?", "What are the key files for Y?". Creates structural node files from answers. Uses getGaps to identify areas needing attention.

## Acceptance criteria

- [ ] Interactive Q&A flow
- [ ] Creates Feature and Component node files from answers
- [ ] Populates refs from developer-provided file paths
- [ ] Uses getGaps to guide which areas to ask about
- [ ] Can be interrupted and resumed

## User stories addressed

- User story 2
