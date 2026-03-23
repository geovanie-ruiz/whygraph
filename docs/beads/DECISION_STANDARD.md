# Decision Recognition Standard

This document serves two purposes:

1. **For this build**: defines the standard for bead staging entries
2. **For whygraph itself**: the core of what ships in agent instructions across all platforms

The recognition heuristic and entry quality guidance below are platform-agnostic.
The bead-specific sections at the bottom apply only to this build.

---

## The Quality Test

Not every choice is worth documenting. The test:

**Would a competent junior engineer, reading the surrounding code and types, be able
to figure out WHY this choice was made?**

- If **yes** — skip it. The code speaks for itself.
- If **no** — they'd need your experience or context to avoid making the wrong call.
  Write it down.

Calibration examples:

- **Worth documenting:** Choosing `MultiDirectedGraph` over `DirectedGraph` — a junior
  wouldn't know the domain requires parallel edges between the same nodes.
- **NOT worth documenting:** Using `const` over `let` — visible from convention.
- **Worth documenting:** Relying on `dropNode()` to cascade-delete edges — implicit
  library behavior a junior wouldn't know about.
- **NOT worth documenting:** Initializing an empty array before a loop when init and
  assignment could be one line — stylistic, visible from context.
- **Worth documenting:** Omitting local validation because an upstream module already
  guarantees the invariant — a junior would add a "safety" check that masks upstream
  bugs. The absence of code is the decision, and nothing in the file explains why it's
  missing.

## Scope

Decisions apply to **production code only** — implementation files, configuration,
types, and data modeling. Test code is out of scope. Test structure, helper patterns,
and coverage choices are not decisions to capture.

## Recognizing Decisions

A decision is a point where you made a choice that passes the quality test above.
Common patterns:

1. **You chose between viable approaches** — even if one was clearly better.
   The "clearly better" reasoning is what a junior needs.

2. **You followed a convention or pattern** a future engineer might not know to follow.
   Why this pattern? What breaks with a different one?

3. **You configured something with specific values** — compiler flags, library options,
   directory structures, data shapes. Each choice excludes alternatives.

4. **You modeled data in a specific way** — type shapes, required vs optional fields,
   unions vs interfaces. Data modeling has deep downstream consequences.

5. **You chose NOT to do something** — didn't add a feature, didn't use a library,
   didn't handle an edge case. Deliberate omissions are decisions. The hardest
   variant: you omitted local defensive code because an upstream module already
   enforces the invariant. Nothing in your file reveals the dependency — a junior
   would add a "safety" check that silently hides upstream bugs.

6. **You invented something not in the spec** — scaffolding, helpers, workarounds.
   If it's not in the requirements, document why it exists.

7. **You ratified a spec-prescribed choice** — the spec said "use X" and you
   implemented it. But the spec choosing X is itself a decision. What alternatives
   does the library offer? Why is X correct here? A junior following the spec
   wouldn't know what else was possible.

8. **You relied on implicit library behavior** — cascade deletes, shallow vs deep
   merge, auto-generated IDs, side effects beyond the method name. If the library
   changed this behavior, your code would silently break. A junior wouldn't know
   this dependency exists.

9. **You kept something from existing code without changing it** — an import, a
   pattern, a data structure. You ratified the original author's choice. Would you
   make the same choice fresh? A junior might "improve" it and break things.

## What Does NOT Count

- Typo fixes, formatting, variable naming (unless the name encodes a design choice)
- Mechanical work with no alternatives ("created the file the spec said to create")
- Anything a junior could figure out from reading surrounding code, types, or tests
- Test code — structure, helpers, coverage boundaries, assertion patterns

## Capture Timing

Write each decision **as close to the moment of making it as possible.** After each
logical unit of work — a function, a type, a config change — ask yourself two questions:

1. "Did I just make a decision?"
2. "What did I deliberately skip or omit?"

Don't batch. The reasoning degrades quickly.

## Post-Work Audit

After completing a unit of work, walk through the production code you wrote:

- **For every file created**: what structural choices did you make?
- **For every function signature**: what API shape did you choose and why?
- **For every library call**: what alternatives exist? What implicit behavior are you
  depending on?
- **For every type defined**: what modeling tradeoffs are embedded?
- **For every error path**: what did you handle vs ignore?
- **For every config value**: what would a different value mean?
- **For every import you kept from existing code**: would you make the same choice fresh?

Apply the quality test to each finding. Only capture the junior-opaque ones.

## Writing Good Entries

**Context** should explain the pressure, not restate the title. "The staging pipeline
handles 8 entry types with different required fields, and downstream code needs to
safely switch on type" tells you what created the fork.

**Decision** should describe what was chosen AND how. "Used approach X: created
separate interfaces per entry type with a literal type field as discriminant" gives
enough to understand without reading the code.

**Tradeoffs** must name what was LOST. Every choice has a cost. If you can't name it,
you haven't thought it through.

**Alternatives** must explain WHY each was rejected. This tells a future engineer
exactly when the alternative might become the right choice.

---

## Bead-Specific Rules (This Build Only)

The following applies to whygraph's own development via beads. These rules will NOT
ship in whygraph's agent instructions — they are scaffolding for self-dogfooding.

### Staging File Location

Write to `.whygraph/staging/bead-<N>.md` using UUIDs from `.whygraph/uuid-map.json`.

### Staging Format

```markdown
## [decision] <concise title describing the choice>

timestamp: <ISO 8601 of when you made this choice>
context: <the problem or fork — what were you trying to solve?>
decision: <what you chose and how you implemented it>
tradeoffs: <what was gained and what was lost>
alternatives: <other approaches considered and WHY each was rejected>
affects: <UUID(s) from .whygraph/uuid-map.json>
tags: <from: arch, data, security, performance, integration, infra, ux>
```

### Calibration Reference

See `.whygraph/staging/bead-1.md` for a calibrated example.
