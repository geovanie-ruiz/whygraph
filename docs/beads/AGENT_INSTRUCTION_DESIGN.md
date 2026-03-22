# Agent Instruction Design

How whygraph teaches agents to capture decisions — the design behind the prompts
that ship with the tool.

## Design Principle: Opinionated on What, Agnostic on When

Whygraph is opinionated about:

- **What to capture**: The 6-category recognition heuristic. This is the core value
  proposition. If agents don't recognize decisions, the tool doesn't work.
- **What to write**: Staging entries with context/decision/tradeoffs/alternatives.
  This structure is what makes decisions queryable, visualizable, and useful.
- **Entry quality**: Tradeoffs must name costs. Alternatives must explain why rejected.
  Context must explain the pressure that created the fork. Without quality, captured
  decisions are noise.

Whygraph is agnostic about:

- **When to capture**: TDD cycles, post-commit, mid-conversation, during review —
  whygraph doesn't prescribe workflow. The universal trigger is "you just wrote or
  changed code."
- **Development methodology**: TDD, trunk-based, feature branches, mob programming —
  doesn't matter. Decisions happen in all of them.
- **Task tracking**: Beads, GitHub issues, Linear, Jira, sticky notes — whygraph
  doesn't care how work is organized. It cares about the decisions made during work.
- **Agent platform**: Claude Code, Cursor, Copilot, or something that doesn't exist
  yet. The staging format and MCP interface are the universal contract.

## How Whygraph Injects Itself

The decision framework lives in `.whygraph/INSTRUCTIONS.md`. Each platform's
structural injection point contains a pointer:

> Before writing, modifying, or deleting code, read and follow `.whygraph/INSTRUCTIONS.md`.

The agent reads INSTRUCTIONS.md when it's about to modify code. The instructions
are directive — they tell the agent how to work in this codebase. The agent captures
decisions as part of its normal workflow, not as a separate activity.

This is the mechanism. There is no fallback loop, no remediation phase, no second
pass. If the instructions are clear enough, the agent complies. If they're not,
the instructions need to be improved.

### Compliance Boundaries

Whygraph can guarantee instruction delivery — every supported platform has a
mechanism to put the pointer in the agent's context before coding starts. Whygraph
cannot guarantee instruction compliance — the agent may read the instructions and
still produce incomplete or low-quality decision entries.

For Claude Code, a post-session hook could warn if code was changed but no staging
entries were written. This is a compliance signal, not enforcement — it surfaces
the gap but can't force the agent to go back.

For other platforms, there is no compliance mechanism beyond the instructions
themselves.

Whygraph should be transparent about this: the tool provides the framework, the
recognition heuristic, the staging format, and the delivery mechanism. The quality
of decision capture depends on the agent's compliance with the instructions. In
practice, a well-written INSTRUCTIONS.md produces good results because modern
agents are instruction-followers by design. But whygraph does not guarantee
completeness.

### Two Distinct Flows

**Flow 1: Agent working on code (primary)**
The agent reads INSTRUCTIONS.md, captures decisions in real-time as it works, writes
staging entries. This is the normal operating mode. The agent is expected to capture
all significant decisions during this flow. There is no "we'll catch it later"
mechanism — what isn't captured here is lost unless a human intervenes.

**Flow 2: Human-driven onboarding (`/whygraph-interview`)**
A developer installs whygraph on an existing codebase that was built before whygraph
existed. The interview skill walks through areas with no recorded decisions
(`get_gaps`) and helps the developer retroactively capture rationale. This data is
inherently lower quality — reconstructed rather than captured in the moment. This
flow exists for onboarding, not as a safety net for Flow 1.

These flows do not interact. An agent working on code (Flow 1) never calls
`get_gaps` or uses the interview skill. A developer onboarding (Flow 2) is not
writing code.

## The Agent Instruction Set

Seven instructions ship with whygraph. The first is the most important and the most
nuanced:

### 1. Capture Decisions (The Core Instruction)

This instruction must accomplish three things:

**Teach recognition.** Agents must learn to notice when they're making a decision.
The 6 categories are the heuristic:

1. Choosing between viable approaches (even if one is clearly better)
2. Following a convention a future agent might not know
3. Configuring with specific values that exclude alternatives
4. Modeling data in a specific way
5. Choosing NOT to do something
6. Inventing something not in the requirements

**Be directive, not advisory.** The instructions tell the agent what to do, not
what it might consider doing. "Write a staging entry for each architectural choice"
is a directive. "Consider capturing decisions as you work" is advisory. The former
produces compliance; the latter produces optional behavior.

**Teach quality.** Context explains pressure. Decision explains implementation.
Tradeoffs name costs. Alternatives explain rejections. Each field has a purpose and
a quality bar. A few high-quality entries are worth more than many low-quality ones.

### 2-7. The Supporting Instructions

2. **Map new code**: Stage `[component]` or `[feature]` entries for new code.
3. **Remove deleted code**: Stage `[node-removed]` entries.
4. **Detect deprecations**: Stage `[deprecate]` entries for deprecation signals.
5. **Update refs**: Stage `[ref-update]` entries when code moves or renames.
6. **Query before modifying**: Call `whygraph_context(file)` to understand constraints.
7. **Respect staleness**: Stop and inform user if MCP returns staleness errors.

## The Interview Skill

`/whygraph-interview` is a human-driven onboarding tool for existing codebases. It
is NOT a remediation mechanism for poor agent capture.

Use case: a developer installs whygraph on a codebase that has been under development
for months or years. The structural tree (features, components) gets mapped via
`/whygraph-scan`. But the decisions behind that structure exist only in the
developer's head. The interview skill extracts them.

The agent calls `get_gaps` to find nodes with no decisions, then walks through them
with the developer. The interviewer must probe specifically:

Good interview questions:

- "What conventions did you follow here? Why those conventions?"
- "What configuration options did you consider?"
- "What did you choose NOT to do? What did you explicitly leave out?"
- "If you were explaining this to a new team member, what would surprise them?"
- "What would go wrong if someone changed this to [alternative]?"

Bad interview questions:

- "What decisions did you make?" (too broad, invites "I don't know")
- "Why did you build it this way?" (invites "it was obvious")

The data quality from interviews is inherently lower than real-time capture because
the developer is reconstructing rationale rather than recording it in the moment.
This is an accepted tradeoff — some recorded rationale is better than none.

## Content Architecture

The decision framework lives in one place: `.whygraph/INSTRUCTIONS.md`. This file
is maintained by whygraph and is the same across all platforms. It contains the 7
agent instructions, the recognition heuristic, the staging format, and the quality
bar.

Each platform's injection point contains a **pointer**, not the content itself:

> Before writing, modifying, or deleting code, read and follow `.whygraph/INSTRUCTIONS.md`.

This follows progressive disclosure — the agent only loads the full framework when
it's about to modify code. Conversations about planning, debugging, explaining, or
reviewing don't trigger the load.

Skills (`/whygraph-scan`, `/whygraph-interview`) go in platform-specific locations
because they're workflows that use platform-specific invocation mechanisms. The
ambient instructions — what the agent needs to know before writing code — live in
`.whygraph/INSTRUCTIONS.md`.

## Platform Injection Architecture

Each platform has a structural injection point — a mechanism that guarantees the
pointer is in the agent's context. The pointer triggers a read of INSTRUCTIONS.md
only when code changes are about to happen.

### Claude Code — Three Layers

**Layer 1: SessionStart hook (structural, durable)**
`whygraph init` configures a SessionStart hook in `.claude/settings.json` that
outputs the pointer: "Before writing, modifying, or deleting code, read and follow
`.whygraph/INSTRUCTIONS.md`."

This is independent of the developer's CLAUDE.md — it survives any changes to that
file. The hook fires every session, injecting the pointer into the agent's context.

**Layer 2: Skills (on-demand, invoked when relevant)**
Skill files in `.claude/skills/whygraph/`:
- `/whygraph-scan` — codebase mapping after init
- `/whygraph-interview` — developer-driven decision capture for existing code

These are workflows, not ambient instructions. They activate when needed.

**Layer 3: Hooks (event-driven)**
Hook in `.claude/settings.json`:
- Session end → deregister from `sessions.json` → trigger `whygraph sync`

This is the mechanical layer. No agent involvement needed.

### Cursor — Two Layers

**Layer 1: Pointer in `.cursor/rules/whygraph.md`**
`whygraph init` writes the pointer to `.cursor/rules/whygraph.md`. Cursor loads
rules into context.

**Layer 2: Git hook**
`.git/hooks/post-commit` triggers `whygraph sync`.

**Warning**: init warns the developer that they are responsible for ensuring the
pointer survives in their environment. If `.cursor/rules/` is regenerated or
overwritten, the pointer must be re-added.

### Copilot — Two Layers

**Layer 1: Pointer in `.github/copilot-instructions.md`**
`whygraph init` appends the pointer. Copilot prepends this file to every prompt.

**Layer 2: Git hook**
Same as Cursor.

**Warning**: same as Cursor — developer is responsible for preserving the pointer.

### Other / Unknown Platforms

`whygraph init` warns that the developer must configure their agent harness to
deliver the pointer. The README explains what the pointer needs to do and why.
The developer adapts the mechanism to their platform.

**Layer 1: Manual pointer configuration**
The developer ensures their agent reads `.whygraph/INSTRUCTIONS.md` before modifying
code, using whatever mechanism their platform supports.

**Layer 2: Manual sync**
User runs `whygraph sync` explicitly.

### What's Identical Across All Platforms

`.whygraph/INSTRUCTIONS.md` — the full decision framework. Same content everywhere.
The pointer text is also identical: "Before writing, modifying, or deleting code,
read and follow `.whygraph/INSTRUCTIONS.md`."

### What Differs

| Platform | Where pointer lives | Pointer durability | How sync triggers | Scan/Interview |
|----------|-------------------|--------------------|-------------------|----------------|
| Claude Code | SessionStart hook in settings.json | Durable — independent of CLAUDE.md | Hook on session end | Skills in .claude/skills/ |
| Cursor | .cursor/rules/whygraph.md | Fragile — developer must preserve | Git hook on commit | Prompts in .whygraph/ |
| Copilot | .github/copilot-instructions.md | Fragile — developer must preserve | Git hook on commit | Prompts in .whygraph/ |
| Other | (manual setup) | Manual — developer configures | Manual CLI | Prompts in .whygraph/ |

### Durability and Developer Responsibility

For Claude Code, the SessionStart hook is durable — it lives in settings.json,
separate from CLAUDE.md, and survives any developer changes to their project
instructions.

For all other platforms, the pointer lives in a file the developer controls. If
they modify or regenerate that file, the pointer may be lost. `whygraph init` warns
about this and the README documents what the pointer does and how to restore it.
This is an accepted limitation — whygraph cannot control files it doesn't own.

## `whygraph prime` — Content Single Source of Truth

`whygraph prime` is a CLI command that prints the condensed decision capture
directive to stdout. It is the single source of truth for what agents need to know
about decision capture. All delivery mechanisms consume its output.

### What prime outputs (~1k tokens)

- The 6-category decision recognition heuristic
- The staging entry format and quality bar
- Staging file naming convention (for concurrent agent safety)
- The timing directive ("capture as you make the choice")
- Component UUID map (if `.whygraph/uuid-map.json` exists)

### What prime does NOT output

- MCP tool instructions (agent may not have MCP access)
- Structural mapping details (component/feature/ref-update)
- Design rationale or documentation

### How prime feeds delivery layers

- **Claude Code SessionStart hook**: `npx whygraph prime` — output injected into
  parent agent context automatically
- **Cursor/Copilot static files**: `whygraph init` calls prime and writes output to
  the platform's rules file
- **Generic/unknown platforms**: Developer runs `whygraph prime > file.md` and
  configures their agent to read it

### prime vs INSTRUCTIONS.md

INSTRUCTIONS.md is the full 102-line reference covering MCP tools, structural
mapping, deprecation detection, and decision capture. `whygraph prime` is the
condensed operational directive focused on what an agent needs to capture decisions
right now.

- `whygraph prime` ⊂ INSTRUCTIONS.md (prime is a subset)
- Prime covers: recognition heuristic, staging format, quality bar, timing, naming
- INSTRUCTIONS.md adds: MCP queries, structural mapping, ref-updates, deprecation

## Sub-Agent Propagation

### The Problem

When an orchestrating agent spawns sub-agents (via Agent tool, worktrees, or similar
mechanisms), those sub-agents do not inherit:

- SessionStart hooks (hooks fire for the parent session only)
- SubagentStart hooks (tested 2026-03-22 — not working in current Claude Code)
- Skills (on-demand workflows, not ambient)

Sub-agents receive only: CLAUDE.md, auto-memory, and the orchestrator's prompt.

### The Solution: Layered Delivery

```
Layer 1: .whygraph/INSTRUCTIONS.md
   │  Universal. Committed to git. Available in any worktree.
   │  Agent reads it when pointed to it. Works everywhere.
   │
Layer 2: whygraph prime (CLI → stdout)
   │  Generates condensed directive at runtime.
   │  Consumed by hooks, scripts, init, or manual piping.
   │
Layer 3: Platform instruction files (auto-loaded into agent context)
   │  Claude Code:  CLAUDE.md pointer → agent reads INSTRUCTIONS.md
   │  Cursor:       .cursor/rules/whygraph.md (static, from prime output)
   │  Copilot:      .github/copilot-instructions.md (static, from prime output)
   │  Generic:      .whygraph/AGENT_CONTEXT.md (static, from prime output)
   │
Layer 4: Platform hooks (automatic, event-driven)
      Claude Code:  SessionStart → npx whygraph prime
      Git:          post-commit → npx whygraph sync (all platforms)
```

Layer 1 is the agnostic baseline — works everywhere.
Layer 3 is the sub-agent fix for Claude Code — CLAUDE.md propagates to sub-agents.
Layer 4 is Claude Code-only automation for the parent session.

### Requirements for Reliable Sub-Agent Capture

1. `.whygraph/INSTRUCTIONS.md` is committed to git (so worktrees have it)
2. The platform's instruction file contains the whygraph pointer
3. Staging files use distinct names (avoid collisions between concurrent agents)
4. Sub-agents commit staging files before ending their session

### What the Orchestrator Should Do

The orchestrator does not need to include INSTRUCTIONS.md content in the sub-agent
prompt — the CLAUDE.md pointer handles this automatically. The orchestrator should:

1. Ensure uncommitted work is committed before creating worktrees
2. Assign distinct staging file names if multiple agents work concurrently
3. Merge worktree branches to collect staging files after agents complete

### SubagentStart Hook Status

Tested 2026-03-22: SubagentStart hooks registered in `.claude/settings.json` did
not fire for Agent tool sub-agents (tested with both Explore and general-purpose
agent types). Sub-agents received CLAUDE.md and auto-memory only.

When SubagentStart hooks become available, register `npx whygraph prime` on that
event. This would give sub-agents the full condensed directive automatically,
eliminating the need for the CLAUDE.md pointer as a delivery mechanism.
