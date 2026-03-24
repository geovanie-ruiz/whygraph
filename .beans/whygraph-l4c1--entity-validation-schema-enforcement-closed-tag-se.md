---
# whygraph-l4c1
title: 'Entity validation: schema enforcement + closed tag set'
status: completed
type: task
priority: critical
tags:
    - afk
    - core
created_at: 2026-03-24T05:32:25Z
updated_at: 2026-03-24T06:01:34Z
parent: whygraph-ileg
blocked_by:
    - whygraph-517u
---

## What to build

Validate entity objects against the schema. Check: required fields present, status values valid for label type, tags from closed set, date format (YYYY-MM-DD), ISO 8601 timestamps, affects references are valid ID format, parent reference is valid ID format. Return all errors (don't stop at first). Validate on parse and before write.

## Acceptance criteria

- [ ] Validates all required fields per entity label
- [ ] Enforces closed tag set
- [ ] Validates date and timestamp formats
- [ ] Validates ID reference formats (affects, parent, supersedes)
- [ ] Collects all errors, doesn't stop at first
- [ ] Distinguishes warnings from hard errors

## User stories addressed

- User story 26, 28
