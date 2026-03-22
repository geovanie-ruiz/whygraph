# Plan: Sub-Agent Decision Capture & Multi-Agent Reliability

## Context

When the orchestrating agent spawns sub-agents via the Agent tool (with or without worktree isolation), those sub-agents don't inherit SessionStart hooks or skills. In our recent experience, two sub-agents implemented beads 3 and 6 without the decision capture framework — they captured 5 decisions each instead of 12-13, and we had to backfill retrospectively.

**Root cause #1**: The orchestrator didn't include INSTRUCTIONS.md content in sub-agent prompts.
**Root cause #2**: `.whygraph/INSTRUCTIONS.md` was never committed to git, so worktree sub-agents couldn't even find it.
**Root cause #3**: No hook or automatic mechanism injected decision capture rules into sub-agent context.

## Validation: SubagentStart Hooks

**Tested 2026-03-22.** Registered a SubagentStart hook in `.claude/settings.json` that echoed a test string. Spawned two sub-agents (Explore type and general-purpose). Neither received the hook output. Sub-agents received only CLAUDE.md contents and auto-memory.

**Conclusion**: SubagentStart hooks either don't exist yet in this Claude Code version, don't apply to Agent tool sub-agents, or use a different event name. We cannot rely on them today.

**What sub-agents DO receive automatically:**
- CLAUDE.md (project instructions)
- Auto-memory (user's `.claude/projects/` memory files)
- The prompt the orchestrator provides

**What sub-agents DO NOT receive:**
- SessionStart hook output
- SubagentStart hook output (tested, not working)
- Skills
- AGENTS.md contents

## Approach: `whygraph prime` + Layered Delivery

### `whygraph prime`

A CLI command that prints the condensed decision capture directive to stdout. It is the **single source of truth** for what agents need to know about decision capture. All delivery mechanisms consume its output.

`whygraph prime` prints:
- The decision recognition heuristic (6 categories)
- The staging entry format and quality bar
- The staging file naming convention
- The timing directive ("capture as you make the choice")
- A compact version of the uuid-map for `affects:` fields (if it exists)

It does NOT print:
- MCP tool instructions (agent may not have MCP access)
- Structural mapping details (component/feature/ref-update — secondary concern)
- Design rationale or documentation

Target size: ~1k tokens.

### Layered delivery model

The core insight: every agent environment has some mechanism for loading instructions into context. They differ in durability, automation, and sub-agent propagation. `whygraph prime` generates the content; the delivery layer gets it to the agent.

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
      Claude Code:  SessionStart → npx whygraph prime (injects into parent session)
      Cursor:       (none — no hook system)
      Git:          post-commit → npx whygraph sync (all platforms with git)
```

**Layer 1 is the agnostic baseline.** It works in every environment that can read files. The pointer to it goes in whatever instruction file the platform auto-loads (CLAUDE.md, .cursor/rules/, copilot-instructions.md). This is the sub-agent fix for today — CLAUDE.md propagates to sub-agents, the pointer tells them to read INSTRUCTIONS.md, INSTRUCTIONS.md is committed to git so worktrees have it.

**Layer 2 is the content generator.** `whygraph prime` produces the text that feeds all other layers. When `whygraph init --cursor` runs, it calls `whygraph prime` and writes the output to `.cursor/rules/whygraph.md`. When a developer wants to manually inject context into an unsupported environment, they run `whygraph prime` and paste the output. One command, many targets.

**Layer 3 is platform-specific static delivery.** Each platform has a file that gets auto-loaded into agent context. `whygraph init` writes to the right file for the detected (or specified) environment. For Claude Code, this is CLAUDE.md with a pointer. For Cursor, it's the rules file with the full prime output (since Cursor can't run hooks). For Copilot, it's the instructions file. For unknown platforms, it's `.whygraph/AGENT_CONTEXT.md` that the developer can include however their platform supports.

**Layer 4 is Claude Code-specific automation.** SessionStart hook runs `whygraph prime` so the parent agent gets fresh context every session. Stop hook runs `whygraph sync`. SubagentStart would be ideal here but doesn't work today — when it does, we add it. Until then, sub-agents fall back to Layer 3 (CLAUDE.md pointer).

### Sub-agent coverage by platform

| Platform | Parent agent | Sub-agents | How sub-agents get context |
|----------|-------------|------------|---------------------------|
| Claude Code | Layer 4 (SessionStart hook) | Layer 3 (CLAUDE.md pointer) | CLAUDE.md propagates, agent reads INSTRUCTIONS.md |
| Cursor | Layer 3 (.cursor/rules/) | N/A (no sub-agents) | — |
| Copilot | Layer 3 (copilot-instructions.md) | N/A (no sub-agents) | — |
| Generic | Layer 1 (INSTRUCTIONS.md) | Depends on platform | Developer configures per platform |

### Toward `.claude-plugin` without depending on it

`whygraph prime` mirrors `bd prime` — this is the pattern Claude Code plugins use. The lifecycle is self-contained:
- `whygraph init` → registers hooks, writes instruction files
- `whygraph prime` → injects context (SessionStart hook)
- `whygraph sync` → processes staging (Stop hook)
- `whygraph mcp` → read-only graph queries (MCP server)

This is plugin-shaped without depending on a plugin spec. When `.claude-plugin` becomes real, the migration path is: move hook/skill/MCP registration into a manifest file. The CLI commands don't change.

### Agnostic coverage without opinion

Whygraph's design principle is "opinionated on what, agnostic on when." The delivery model extends this:

- **Opinionated**: what to capture (6 categories), how to write it (staging format), quality bar (tradeoffs must name costs)
- **Agnostic**: how the instructions reach the agent (hooks, files, manual injection — whygraph provides the content, the platform provides the mechanism)

For platforms whygraph doesn't know about, `whygraph prime > your-file.md` is the escape hatch. The developer becomes the delivery mechanism. This is acceptable because whygraph can't predict every platform, and the cost of manual injection is low (one command, run once per project setup).

## Changes

### 1. Commit `.whygraph/` repo-native files to git

INSTRUCTIONS.md, config.json, events.jsonl, .gitignore must be tracked so worktrees have them.

### 2. Add whygraph pointer to CLAUDE.md

```markdown
## Decision Capture

This project uses whygraph for architectural decision tracking. Before writing,
modifying, or deleting code, read and follow `.whygraph/INSTRUCTIONS.md`. Write
staging entries to `.whygraph/staging/` for every architectural choice you make —
capture decisions in real-time as you work, not at the end of a session.
```

This is the sub-agent fix. CLAUDE.md propagates to sub-agents. The pointer tells them to read INSTRUCTIONS.md. INSTRUCTIONS.md is committed to git. The chain is: CLAUDE.md → pointer → INSTRUCTIONS.md → agent captures decisions.

### 3. Build `whygraph prime` CLI command

New file: `src/cli/prime.ts`

Reads config and uuid-map, prints condensed directive to stdout. This is the single source of truth that feeds all delivery mechanisms.

### 4. Update SessionStart hook to use `whygraph prime`

Replace the current echo pointer with `npx whygraph prime`. This gives the parent agent the full condensed directive instead of just a pointer.

### 5. Add staging file naming guidance to INSTRUCTIONS.md

Prescribe naming convention to avoid collisions between concurrent sub-agents.

### 6. Update AGENT_INSTRUCTION_DESIGN.md

Document:
- The `whygraph prime` command and its role as content SSOT
- The layered delivery model
- SubagentStart hook status (tested, not working, will add when available)
- Cross-platform delivery strategy
- The escape hatch for unknown platforms

### 7. AGENTS.md cleanup

Replace the beads integration block with a lean pointer to `bd prime`.

## Files

| File | Change |
|------|--------|
| `src/cli/prime.ts` | New — the prime command |
| `src/cli/index.ts` | Add prime subcommand |
| `.claude/settings.json` | Update SessionStart to use `whygraph prime` |
| `.whygraph/INSTRUCTIONS.md` | Add staging file naming guidance |
| `CLAUDE.md` | Add pointer (sub-agent propagation) |
| `AGENTS.md` | Replace beads block with pointer |
| `docs/beads/AGENT_INSTRUCTION_DESIGN.md` | Document layered delivery |
| `.whygraph/.gitignore` | Already updated (reviews.jsonl added) |

## Verification

1. `npx whygraph prime` prints condensed directive to stdout
2. `git worktree add /tmp/test-wt -b test-wt` → `/tmp/test-wt/.whygraph/INSTRUCTIONS.md` exists
3. Spawn sub-agent → receives CLAUDE.md pointer → reads INSTRUCTIONS.md → creates staging entries with decisions
4. `whygraph prime > /tmp/cursor-test.md` produces a file usable as Cursor rules

## What This Does NOT Solve

- **Compliance**: Delivery ≠ compliance. Whygraph guarantees the instructions reach the agent. Whether the agent follows them depends on instruction quality and agent capability.
- **SubagentStart hooks**: Not working today. When they become available, add them as Layer 4 enhancement. The CLAUDE.md pointer (Layer 3) covers sub-agents until then.
- **Unknown platforms**: Whygraph can't auto-configure platforms it doesn't know about. The `whygraph prime` escape hatch lets developers manually inject context.
