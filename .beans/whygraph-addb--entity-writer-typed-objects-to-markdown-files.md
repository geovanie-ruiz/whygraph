---
# whygraph-addb
title: 'Entity writer: typed objects to markdown files'
status: completed
type: task
priority: critical
tags:
    - afk
    - core
created_at: 2026-03-24T05:32:25Z
updated_at: 2026-03-24T06:05:14Z
parent: whygraph-ileg
blocked_by:
    - whygraph-517u
    - whygraph-fqag
---

## What to build

Write a typed Entity object to disk as a markdown file with YAML front matter. Generate the filename using NanoID + slug conventions. Render front matter from entity fields, render markdown body from structured content. Ensure atomic writes (write to temp file, rename).

## Acceptance criteria

- [ ] Renders entity to markdown with correct YAML front matter
- [ ] Uses NanoID + slug file naming
- [ ] Atomic write (temp file + rename)
- [ ] Roundtrip: parse(write(entity)) === entity
- [ ] Creates parent directories if needed

## User stories addressed

- User story 12
