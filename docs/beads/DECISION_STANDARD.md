# Decision Recognition Standard

This document serves two purposes:

1. **For this build**: defines the standard for bead staging entries
2. **For whygraph itself**: the core of what ships in agent instructions across all platforms

The recognition heuristic and entry quality guidance below are platform-agnostic.
The bead-specific sections at the bottom apply only to this build.

---

## The Invisible Decision Trap

The most important decisions to capture are the ones that feel obvious. If you chose
approach A without hesitation, a future agent has no way to know that B and C existed
and were rejected. The "obvious" choice becomes invisible rationale — the exact
cognitive debt whygraph exists to prevent.

**If you followed a convention, document why that convention was chosen over alternatives.**
**If something felt obvious, explain what makes it obvious — that reasoning is the value.**

## Recognizing Decisions

A decision is ANY point where:

1. **You chose between viable approaches** — even if one was clearly better.
   The "clearly better" reasoning is what needs capturing.

2. **You followed a convention or pattern** that a future agent might not know to follow.
   Why this pattern? What would go wrong with a different one?

3. **You configured something with specific values** — compiler flags, library options,
   directory structures, data shapes. Each configuration choice excludes alternatives.

4. **You modeled data in a specific way** — type shapes, required vs optional fields,
   unions vs interfaces, separate types vs unified types. Data modeling choices have
   deep downstream consequences.

5. **You chose NOT to do something** — didn't add a feature, didn't use a library,
   didn't handle an edge case. Deliberate omissions are decisions.

6. **You invented something not in the spec** — scaffolding, helper types, utilities,
   workarounds. If it's not in the requirements, document why it exists.

## What Does NOT Count

- Typo fixes, formatting changes, variable naming (unless the name encodes a design choice)
- Mechanical work with no alternatives (e.g., "created the file the spec told me to create")

## Capture Timing

Capture decisions **as close to the moment of making them as possible**. Retrospective
capture after a large block of work loses forks — you forget the alternatives you
considered and the reasoning collapses to "it was obvious."

The universal trigger is: **you just wrote or changed code.** After each logical unit
of work — a function written, a file created, a config changed, a type defined —
pause and ask: "did I just make a decision?"

This adapts to any workflow:

- **TDD**: after each RED→GREEN cycle, write the staging entry immediately
- **Feature development**: after each function, type, or config written, write the entry
- **Refactoring**: every structural change is a decision — write the entry before moving on
- **Bug fixing**: the fix and the diagnosis are both decisions

The key principle: **write each entry as soon as you make the choice.** Don't batch.
The reasoning degrades within minutes — capture it while it's fresh.

## Post-Work Audit

After completing a unit of work, review what you built against this checklist. If
you missed any decisions during real-time capture, write the entries now — but
recognize that retrospective entries are lower quality than real-time ones.

- **For every file created**: what structural choices did you make?
- **For every function signature**: what API shape did you choose and why?
- **For every library call**: what alternatives exist in that library or others?
- **For every type defined**: what modeling tradeoffs are embedded?
- **For every error path**: what did you handle vs ignore?
- **For every test written**: what behavior did you test vs skip?
- **For every config value**: what would a different value mean?

## Writing Good Entries

The staging entry format has four substantive fields. Each has a quality bar:

**Context** should explain the problem, not restate the title. "Needed to choose X"
is weak. "The staging pipeline handles 8 entry types with different required fields,
and downstream code needs to safely switch on type" is strong — it tells you what
pressure created the fork.

**Decision** should describe what was chosen AND how. "Used approach X" is incomplete.
"Used approach X: created separate interfaces per entry type with a literal type
field as discriminant, combined into a union type" gives a future agent enough to
understand the implementation without reading the code.

**Tradeoffs** must name what was LOST, not just what was gained. "Gained type safety"
is incomplete. "Gained compile-time exhaustiveness checking. Lost conciseness — 8
separate interfaces is verbose" is honest. Every choice has a cost; if you can't
name it, you haven't thought it through.

**Alternatives** must explain WHY each was rejected, not just that it was. "Rejected
alternative X" is useless. "X rejected because it loses compile-time enforcement
of required fields per node type" tells a future agent exactly when X might become
the right choice — if the conditions that caused rejection change, the alternative
should be reconsidered.

---

## Bead-Specific Rules (This Build Only)

The following applies to whygraph's own development via beads. These rules will NOT
ship in whygraph's agent instructions — they are scaffolding for self-dogfooding.

### Minimum Bar

Every bead MUST produce at least 3 decisions. If you think you made fewer than 3,
run the post-work audit checklist above.

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

See `.whygraph/staging/bead-1.md` for a calibrated example: 10 decisions from a
scaffolding task that initially appeared to have only 2.
