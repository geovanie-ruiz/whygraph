import * as fs from "node:fs";
import * as path from "node:path";

function findWhygraphDir(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, ".whygraph");
    if (fs.existsSync(path.join(candidate, "config.json"))) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function loadUuidMap(whygraphDir: string): Record<string, string> | null {
  const mapPath = path.join(whygraphDir, "uuid-map.json");
  try {
    return JSON.parse(fs.readFileSync(mapPath, "utf-8")) as Record<string, string>;
  } catch {
    return null;
  }
}

function formatUuidHints(uuidMap: Record<string, string>): string {
  const lines = Object.entries(uuidMap)
    .map(([name, uuid]) => `  ${name}: ${uuid}`)
    .join("\n");
  return `
## Component UUIDs (scaffold — will be replaced by MCP queries)

Use these for the \`affects\` field in staging entries:

${lines}
`;
}

export function prime(startDir: string = process.cwd()): string {
  const whygraphDir = findWhygraphDir(startDir);

  let appName = "this project";
  if (whygraphDir) {
    try {
      const config = JSON.parse(
        fs.readFileSync(path.join(whygraphDir, "config.json"), "utf-8"),
      );
      if (config.appName) appName = config.appName;
    } catch {
      // use default
    }
  }

  // UUID map is a temporary scaffold until MCP is functional
  const uuidMap = whygraphDir ? loadUuidMap(whygraphDir) : null;
  const uuidSection = uuidMap ? formatUuidHints(uuidMap) : "";

  return `# Whygraph — Agent Instructions

${appName} tracks architectural decisions in \`.whygraph/events.jsonl\`. These
instructions apply whenever you are writing, modifying, or deleting code.

## Before Modifying Code

Call \`whygraph_context(file)\` via MCP for every file you are about to modify. This
returns existing architectural decisions and constraints for that area of the
codebase. Respect these constraints — if a decision says "X was rejected because Y,"
don't reintroduce X unless the conditions behind Y have changed.

If \`whygraph_context\` returns no decisions for a file, that area has no recorded
rationale. Write staging entries for every architectural choice you make in that area.

If any whygraph MCP tool returns a staleness error, stop and inform the user.

## Capturing Decisions

Write staging entries to \`.whygraph/staging/\` for decisions about the production
code you write. Not every choice is worth documenting. The test:

**Would a competent junior engineer, reading the surrounding code and types, figure
out WHY this choice was made?** If yes, skip it. If no, write it down.

Decisions apply to **production code only** — not tests, not absent code you never
considered writing.

### Recognizing Decisions

A decision is a point where you made a choice that passes the quality test above:

1. **You chose between viable approaches** — even if one was clearly better. The
   "clearly better" reasoning is what a junior needs.
2. **You followed a convention or pattern** a future engineer might not know to follow.
   Why this pattern? What breaks with a different one?
3. **You configured something with specific values** — compiler flags, library options,
   directory structures, data shapes. Each choice excludes alternatives.
4. **You modeled data in a specific way** — type shapes, required vs optional fields,
   unions vs interfaces. Data modeling has deep downstream consequences.
5. **You actively chose NOT to do something** — you considered adding a feature,
   library, or edge case handler and decided against it. The key word is *actively*:
   you had the thought "should I do X?" and chose no. If you never considered X,
   not doing X is not your decision to document.
6. **You invented something not in the spec** — scaffolding, helpers, workarounds.
   If it's not in the requirements, document why it exists.
7. **You ratified a spec-prescribed choice** — the spec said "use X" and you
   implemented it. What alternatives does the library offer? Why is X correct here?
   A junior following the spec wouldn't know what else was possible.
8. **You relied on implicit library behavior** — cascade deletes, shallow vs deep
   merge, auto-generated IDs, side effects beyond the method name. If the library
   changed this behavior, your code would silently break.
9. **You kept something from existing code without changing it** — an import, a
   pattern, a data structure. You ratified the original author's choice. Would you
   make the same choice fresh? A junior might "improve" it and break things.

### What Does NOT Count

- Anything a junior could figure out from reading surrounding code, types, or tests
- Typo fixes, formatting, variable naming (unless the name encodes a design choice)
- Mechanical work with no alternatives
- Test code — structure, helpers, coverage boundaries, assertion patterns
- Absent code you never considered writing

### Capture Timing

Write each decision as close to the moment of making it as possible. After each
logical unit of work, ask: "Did I just make a decision about the code I wrote?"

### Post-Work Audit

After completing your work, review the production code **you wrote** — every line
you added or changed. The audit is scoped to your work, not to what's absent.

- For every function you wrote: what API shape did you choose and why?
- For every library call you made: what alternatives exist? What implicit behavior
  are you depending on?
- For every type you defined: what modeling tradeoffs are embedded?
- For every error path you implemented: what did you handle and why that way?
- For every config value you set: what would a different value mean?

Do NOT audit for absent code — features you didn't add, checks you didn't write,
patterns you never considered.

### Staging Entry Format

Write entries to \`.whygraph/staging/\` in this format:

\`\`\`markdown
## [decision] <concise title describing the choice>
timestamp: <ISO 8601>
context: <the problem or constraint that created this fork — what were you solving?>
decision: <what you chose and how you implemented it>
tradeoffs: <what was gained AND what was lost — be specific>
alternatives: <other approaches you considered and WHY each was rejected>
affects: <node UUID(s) this decision touches>
files-touched: <file paths you modified, if no UUIDs available>
tags: <comma-separated from: arch, data, security, performance, integration, infra, ux>
\`\`\`

**Quality bar:**
- Context explains the pressure, not just restates the title
- Tradeoffs name what was LOST, not just what was gained
- Alternatives explain WHY each was rejected — this tells a future agent when the
  alternative might become the right choice

### Staging File Naming

Name your staging file descriptively to avoid collisions with concurrent agents:
- If working on a tracked task: \`staging/<task-id>.md\` (e.g., \`staging/issue-42.md\`)
- If no task system: \`staging/<descriptive-slug>.md\` (e.g., \`staging/auth-refactor.md\`)
- Never use generic names like \`staging/decisions.md\` that multiple agents might target

Commit all staging files before ending your session.

## Mapping Code Changes

When you **create a new file or module**, stage a structural entry:

\`\`\`markdown
## [component] <name>
parent: <UUID of parent feature or component>
description: <what this component does>
refs:
  - file: <path>, symbol: <exported name>
\`\`\`

If you're building an entirely new functional area, use \`[feature]\` instead. When in
doubt, create a component — features are rare.

When you **delete an entire module or feature**, stage a removal:

\`\`\`markdown
## [node-removed] <UUID>
\`\`\`

When you **rename or move code**, update the refs:

\`\`\`markdown
## [ref-update] <UUID>
add:
  - file: <new path>, symbol: <new name>
remove:
  - file: <old path>, symbol: <old name>
\`\`\`

When you **encounter a deprecation signal** (changelogs, compiler warnings, API
deprecation notices), stage the relationship:

\`\`\`markdown
## [deprecate] <old-UUID> <new-UUID>
\`\`\`
${uuidSection}`;
}

export function runPrime(): void {
  process.stdout.write(prime() + "\n");
}
