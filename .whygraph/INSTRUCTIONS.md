# Whygraph — Agent Instructions

This project tracks architectural decisions in `.whygraph/events.jsonl`. These
instructions apply whenever you are writing, modifying, or deleting code.

## Before Modifying Code

Call `whygraph_context(file)` via MCP for every file you are about to modify. This
returns existing architectural decisions and constraints for that area of the
codebase. Respect these constraints — if a decision says "X was rejected because Y,"
don't reintroduce X unless the conditions behind Y have changed.

If `whygraph_context` returns no decisions for a file, that area has no recorded
rationale. Write staging entries for every architectural choice you make in that area.

If any whygraph MCP tool returns a staleness error, stop and inform the user.

## Capturing Decisions

Write staging entries to `.whygraph/staging/` for every architectural choice you
make. A decision is any point where you:

1. **Chose between viable approaches** — even if one was clearly better. The "clearly
   better" reasoning is what a future agent needs.
2. **Followed a convention or pattern** a future agent might not know to follow. Why
   this pattern? What would go wrong with a different one?
3. **Configured something with specific values** — compiler flags, library options,
   directory structures. Each configuration choice excludes alternatives.
4. **Modeled data in a specific way** — type shapes, required vs optional fields,
   unions vs interfaces. Data modeling choices have deep downstream consequences.
5. **Chose NOT to do something** — didn't add a feature, didn't use a library, didn't
   handle an edge case. Deliberate omissions are decisions.
6. **Invented something not in the requirements** — scaffolding, helpers, workarounds.
   If it's not in the spec, document why it exists.

The most important decisions to capture are the ones that feel obvious. If you chose
an approach without hesitation, a future agent has no way to know that alternatives
existed and were rejected. That invisible rationale is the exact cognitive debt this
tool exists to prevent.

Write each staging entry as soon as you make the choice, not at the end of a session.
The reasoning degrades within minutes — capture it while it's fresh.

### Staging Entry Format

Write entries to `.whygraph/staging/` in this format:

```markdown
## [decision] <concise title describing the choice>
timestamp: <ISO 8601>
context: <the problem or constraint that created this fork — what were you solving?>
decision: <what you chose and how you implemented it>
tradeoffs: <what was gained AND what was lost — be specific>
alternatives: <other approaches you considered and WHY each was rejected>
affects: <node UUID(s) this decision touches>
files-touched: <file paths you modified, if no UUIDs available>
tags: <comma-separated from: arch, data, security, performance, integration, infra, ux>
```

**Quality bar:**
- Context explains the pressure, not just restates the title
- Tradeoffs name what was LOST, not just what was gained
- Alternatives explain WHY each was rejected — this tells a future agent when the
  alternative might become the right choice

## Mapping Code Changes

When you **create a new file or module**, stage a structural entry:

```markdown
## [component] <name>
parent: <UUID of parent feature or component>
description: <what this component does>
refs:
  - file: <path>, symbol: <exported name>
```

If you're building an entirely new functional area, use `[feature]` instead. When in
doubt, create a component — features are rare.

When you **delete an entire module or feature**, stage a removal:

```markdown
## [node-removed] <UUID>
```

When you **rename or move code**, update the refs:

```markdown
## [ref-update] <UUID>
add:
  - file: <new path>, symbol: <new name>
remove:
  - file: <old path>, symbol: <old name>
```

When you **encounter a deprecation signal** (changelogs, compiler warnings, API
deprecation notices), stage the relationship:

```markdown
## [deprecate] <old-UUID> <new-UUID>
```
