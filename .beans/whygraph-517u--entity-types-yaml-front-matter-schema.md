---
# whygraph-517u
title: Entity types + YAML front matter schema
status: todo
type: task
priority: critical
tags:
    - afk
    - core
created_at: 2026-03-24T05:32:25Z
updated_at: 2026-03-24T05:32:25Z
parent: whygraph-ileg
---

## What to build

Define the TypeScript type system for all whygraph entities. This includes types for structural nodes (App, Feature, Component), Decision nodes, and the unified Entity type. Each entity has YAML front matter fields: id, label, title/name, status, created_at, updated_at, removed_at (optional). Decisions add: date, affects, tags, supersedes, context, decision, tradeoffs, alternatives. Structural nodes add: parent, refs, description.

Define the closed tag set type. Define status types (active/superseded for decisions, active/deprecated for structural nodes). Define the config schema type.

## Acceptance criteria

- [ ] All entity types defined with strict TypeScript interfaces
- [ ] Closed tag set as union type
- [ ] Status types per entity label
- [ ] Config schema type with all fields from PRD
- [ ] Front matter schema documented in types
- [ ] All types exported as named exports

## User stories addressed

- User story 29, 30
