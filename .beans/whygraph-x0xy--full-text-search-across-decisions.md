---
# whygraph-x0xy
title: Full-text search across decisions
status: todo
type: task
priority: normal
tags:
    - afk
    - core
created_at: 2026-03-24T05:33:12Z
updated_at: 2026-03-24T05:33:12Z
parent: whygraph-ileg
blocked_by:
    - whygraph-whi8
---

## What to build

Full-text search across all decision entities. Search title, context, decision, tradeoffs, alternatives fields. Return matching decisions ranked by relevance. Can use a simple in-memory index or string matching for v1.

## Acceptance criteria

- [ ] Searches across title and body sections of decisions
- [ ] Returns matching decisions
- [ ] Case-insensitive matching
- [ ] Handles empty search queries gracefully

## User stories addressed

- User story 32
