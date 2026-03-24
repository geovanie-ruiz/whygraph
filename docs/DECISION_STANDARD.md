# Decision Recognition Standard

How agents recognize and capture architectural decisions. This is the core of what
ships in agent instructions across all platforms.

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
- **NOT worth documenting:** Initializing an empty array before a loop — stylistic,
  visible from context.
- **NOT a decision:** Code you never considered writing. If you never thought "should
  I add a sort here?" then the absence of a sort is not your decision to document.

## Scope

Decisions apply to **production code only** — implementation files, configuration,
types, and data modeling. Test code is out of scope.

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

5. **You actively chose NOT to do something** — you considered adding a feature,
   library, or edge case handler and decided against it. The key word is *actively*:
   you had the thought "should I do X?" and chose no.

6. **You invented something not in the spec** — scaffolding, helpers, workarounds.
   If it's not in the requirements, document why it exists.

7. **You ratified a spec-prescribed choice** — the spec said "use X" and you
   implemented it. But the spec choosing X is itself a decision. What alternatives
   does the library offer? Why is X correct here?

8. **You relied on implicit library behavior** — cascade deletes, shallow vs deep
   merge, auto-generated IDs, side effects beyond the method name.

9. **You kept something from existing code without changing it** — an import, a
   pattern, a data structure. You ratified the original author's choice.

## What Does NOT Count

- Typo fixes, formatting, variable naming (unless the name encodes a design choice)
- Mechanical work with no alternatives ("created the file the spec said to create")
- Anything a junior could figure out from reading surrounding code, types, or tests
- Test code — structure, helpers, coverage boundaries, assertion patterns
- Absent code you never considered writing

## Capture Timing

Write each decision **as close to the moment of making it as possible.** After each
logical unit of work — a function, a type, a config change — ask yourself:

"Did I just make a decision about the code I wrote?"

Don't batch. The reasoning degrades quickly.

## Post-Work Audit

After completing a unit of work, review the production code **you wrote** — every
line you added or changed. Walk through your code:

- **For every function you wrote**: what API shape did you choose and why?
- **For every library call you made**: what alternatives exist? What implicit behavior
  are you depending on?
- **For every type you defined**: what modeling tradeoffs are embedded?
- **For every error path you implemented**: what did you handle and why that way?
- **For every config value you set**: what would a different value mean?

Do NOT audit for absent code — features you didn't add, checks you didn't write,
patterns you never considered.

## Writing Good Decisions

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
