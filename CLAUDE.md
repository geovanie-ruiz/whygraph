# CLAUDE.md

The role of this file is to describe common mistakes and confusion points that agents might encounter as they work in this project. If you ever encounter something in the project that surprises you, please alert the developer working with you and indicate that this is the case in the ClaudeMD file to help prevent future agents from having the same issue.

**Do not update this file without explicit approval from the developer.** If you believe a change to CLAUDE.md is warranted, propose the change and wait for confirmation before writing it.

<!-- whygraph:start -->
## Whygraph — Decision Capture

Before writing, modifying, or deleting production code, capture any non-trivial
decision as a Decision node. A decision is non-trivial if a junior engineer would
benefit from knowing why the choice was made.

### Recognition Heuristic

Scan your output for these signals:
- Choosing between alternatives
- Rejecting an approach
- Setting a convention or pattern
- Adding, removing, or changing a dependency
- Configuring infrastructure or deployment
- Making a security or performance tradeoff
- Altering user-facing behavior
- Scoping to production code the agent authored
- Establishing an invariant or constraint

### Decision File Format

Write decision files to `.whygraph/graph/` with YAML frontmatter:

```yaml
---
id: wg-<4-char-nanoid>
label: Decision
title: <short title>
status: active
date: <YYYY-MM-DD>
affects:
  - <entity-id>
tags:
  - <one of: arch, data, security, performance, integration, infra, ux>
created_at: <ISO 8601>
updated_at: <ISO 8601>
---

## Context
<why this decision was needed>

## Decision
<what was decided>

## Tradeoffs
<what was gained and lost>

## Alternatives
<what was considered and rejected>
```

Allowed tags: arch, data, security, performance, integration, infra, ux

### MCP Server

Use the `whygraph` MCP server for decision capture tools.
If the server is unreachable, write decision files directly to `.whygraph/graph/`.

### Server Status

Run `whygraph status` to check if the server is running.
Run `whygraph up` to start the server.
<!-- whygraph:end -->

## Conventions

- ESM throughout — .js extensions on imports in TypeScript source
- Named exports only — no default exports
- Validate before every append — never skip validation
- TDD: red-green-refactor with vitest
- graphology is the graph — do not build parallel data structures
- All CLI commands must accept `--json` for programmatic output
- Error handling: core functions throw typed errors, CLI catches and formats for humans, MCP catches and formats per protocol

## Beans Issue Tracker

This project uses **beans** for issue tracking.

### Quick Reference

```bash
beans list              # See all work
beans show <id>         # View issue details
beans update <id> --status in-progress  # Claim work
beans update <id> --status completed    # Complete work
```

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create beans for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:

   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```

5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
