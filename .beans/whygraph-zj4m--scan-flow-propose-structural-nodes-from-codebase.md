---
# whygraph-zj4m
title: 'Scan flow: propose structural nodes from codebase'
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
---

## What to build

Agent-driven codebase analysis that proposes structural nodes. Scans directory structure, package.json, module exports, and import graphs to identify features and components. Outputs a proposed structure for developer review. On approval, creates node files.

## Acceptance criteria

- [ ] Analyzes codebase directory structure
- [ ] Proposes Feature nodes from top-level modules
- [ ] Proposes Component nodes from sub-modules
- [ ] Outputs proposal for developer review
- [ ] Creates node files on approval
- [ ] Handles monorepos and common project structures

## User stories addressed

- User story 3
