# Plan: Sub-Agent Decision Capture & Multi-Agent Reliability

## Status: Implemented

Core implementation complete as of 2026-03-22. Remaining items noted at bottom.

## Problem

When an orchestrating agent spawns sub-agents, those sub-agents don't inherit
hooks, skills, or ambient context. In our experience, sub-agents implemented
code without the decision capture framework — capturing 5 decisions instead of
12-13 because the instructions never reached them.

**Root causes:**
1. `.whygraph/INSTRUCTIONS.md` was not committed to git — worktrees didn't have it
2. No mechanism injected decision capture rules into sub-agent context
3. CLAUDE.md had no mention of whygraph

## Solution: `whygraph prime` + Conditional Triggers

### `whygraph prime`

A CLI command that prints the complete decision capture instructions to stdout.
It is the **single source of truth** for what agents need to know. All delivery
mechanisms point agents to run this command.

Prime outputs the full instructions:
- MCP query directive (`whygraph_context(file)` before modifying code)
- Staleness error handling (stop and inform user)
- Decision recognition heuristic (6 categories)
- Staging entry format and quality bar
- Staging file naming convention (concurrent agent safety)
- Timing directive ("capture as you make the choice")
- Structural mapping entries (component, feature, ref-update, deprecate, node-removed)
- UUID map scaffold (temporary — removed when MCP is functional)

### Conditional triggers in instruction files

Every platform has an instruction file that agents auto-load. Whygraph writes a
conditional trigger to that file — not a context dump. The trigger tells the
agent WHEN to run prime:

> Before writing, modifying, or deleting code, run `whygraph prime`.

This achieves progressive disclosure. An agent doing research doesn't load
whygraph instructions. An agent about to modify code runs prime and gets the
full framework. Multiple tools can coexist in the same instruction file without
context explosion because each only triggers when relevant.

### How each platform gets the trigger

| Platform | Instruction file | What init writes |
|----------|-----------------|-----------------|
| Claude Code | CLAUDE.md | Conditional trigger with `<!-- BEGIN/END WHYGRAPH -->` markers |
| Cursor | .cursor/rules/whygraph.md | "run `whygraph prime`" |
| Copilot | .github/copilot-instructions.md | "run `whygraph prime`" |
| Other | Developer configures manually | "run `whygraph prime`" |

The instruction is identical across all platforms. Only the file location differs.

### How sub-agents get the trigger

**Claude Code**: sub-agents receive CLAUDE.md automatically. The conditional
trigger in CLAUDE.md tells them to run `whygraph prime`. This works because
CLAUDE.md is loaded before the task prompt — primacy bias ensures the agent
treats decision capture as a standing order, not a mid-task interruption.

**Other platforms**: most don't have sub-agents today. When they do, their
sub-agent context inheritance determines whether the trigger propagates. If
the platform inherits instruction files, it works automatically.

### How `whygraph init` sets up each platform

Init performs five actions:
1. Create `.whygraph/` directory structure (universal)
2. Seed `events.jsonl` with App node (universal)
3. Write `config.json` with collected preferences (universal)
4. Write conditional trigger to platform instruction file
5. Register MCP server (platform-specific config location)

For Claude Code, init also registers a SessionStart hook that runs
`whygraph prime` — this gives the parent agent the instructions via hook
stdout injection, complementing the CLAUDE.md trigger for sub-agents.

### SubagentStart hooks

Tested 2026-03-22. SubagentStart hooks in `.claude/settings.json` did not
fire for Agent tool sub-agents (tested with Explore and general-purpose types).
Claude's built-in agent types don't use lifecycle hooks — custom agents defined
in `.claude/agents/` would be needed. Since defining sub-agents is a developer
concern (not whygraph's), CLAUDE.md is the sub-agent delivery mechanism.

When SubagentStart hooks work for built-in agent types, register `whygraph prime`
on that event as an enhancement.

### INSTRUCTIONS.md vs prime

Prime is the primary mechanism. INSTRUCTIONS.md is a static reference file for
developers who want to manually include whygraph instructions in an unsupported
environment. The content should be the same — prime is the dynamic generator,
INSTRUCTIONS.md is the static snapshot.

### Worktree guidance

Worktrees only contain tracked files. For sub-agents running in worktrees:
- All `.whygraph/` repo-native files must be committed before creating worktrees
- The worktree needs `npm install` (or access to node_modules) for `whygraph prime` to run
- The orchestrating agent is responsible for ensuring the worktree is ready

This is documented as advisory guidance, not enforced mechanically.

### No enforcement mechanisms

If prime output is in context with primacy bias, agents follow it. The failure
we experienced was not an agent ignoring instructions — it was an agent that
never received them. Fixing delivery fixes compliance.

## What's Done

- [x] `whygraph prime` CLI command — outputs full instructions to stdout
- [x] SessionStart hook runs `whygraph prime` (no fallback)
- [x] CLAUDE.md has conditional trigger with markers
- [x] INSTRUCTIONS.md has staging file naming convention
- [x] AGENT_INSTRUCTION_DESIGN.md documents layered delivery and sub-agent propagation
- [x] AGENTS.md trimmed (beads owns its block via `bd setup claude`)
- [x] `.whygraph/` repo-native files committed to git
- [x] SubagentStart hooks tested and documented as non-functional

## What Remains

- [ ] Refactor prime to not include UUID map once MCP server is functional (bead 13)
- [ ] Verify sub-agent capture: spawn a sub-agent, confirm it runs prime, confirm it creates staging entries
- [ ] Write worktree advisory guidance in documentation
- [ ] Update plan document to final state after verification
