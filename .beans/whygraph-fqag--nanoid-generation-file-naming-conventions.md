---
# whygraph-fqag
title: NanoID generation + file naming conventions
status: completed
type: task
priority: critical
tags:
    - afk
    - core
created_at: 2026-03-24T05:32:25Z
updated_at: 2026-03-24T06:00:01Z
parent: whygraph-ileg
blocked_by:
    - whygraph-517u
---

## What to build

Implement NanoID generation for entity IDs using [0-9a-z] alphabet, 4 characters by default. Read prefix and id_length from config. Implement file naming: `<prefix><nanoid>--<slug>.md`. Implement slug generation from titles (lowercase, hyphenated, truncated). Implement ID extraction from filenames. Handle the double-dash separator convention.

## Acceptance criteria

- [ ] NanoID generation with configurable alphabet, length, prefix
- [ ] Slug generation from arbitrary titles
- [ ] Filename composition: id + slug
- [ ] ID extraction from filename
- [ ] No offensive substrings in generated IDs

## User stories addressed

- User story 12, 18
