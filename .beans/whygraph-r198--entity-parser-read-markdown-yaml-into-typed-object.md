---
# whygraph-r198
title: 'Entity parser: read markdown + YAML into typed objects'
status: todo
type: task
priority: critical
tags:
    - afk
    - core
created_at: 2026-03-24T05:32:25Z
updated_at: 2026-03-24T05:32:48Z
parent: whygraph-ileg
blocked_by:
    - whygraph-517u
---

## What to build

Parse a `.whygraph/graph/*.md` file into a typed Entity object. Read YAML front matter (using a library like gray-matter), extract all typed fields, capture the markdown body. Handle both structural nodes and decisions from the same parser. Return typed objects matching the entity type system from bean 1.

## Acceptance criteria

- [ ] Parses YAML front matter into typed fields
- [ ] Extracts markdown body sections (Context, Decision, Tradeoffs, Alternatives for decisions)
- [ ] Handles both structural node and decision entity files
- [ ] Returns null or error for unparseable files (doesn't throw)
- [ ] Preserves all front matter fields including optional ones

## User stories addressed

- User story 12
