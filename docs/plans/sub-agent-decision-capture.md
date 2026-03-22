# Plan: Sub-Agent Decision Capture & Multi-Agent Reliability

## Context

When the orchestrating agent spawns sub-agents via the Agent tool (with or without worktree isolation), those sub-agents don't inherit SessionStart hooks or skills. The only context they automatically receive is CLAUDE.md. In our recent experience, two sub-agents implemented beads 3 and 6 without the decision capture framework — they captured 5 decisions each instead of 12-13, and we had to backfill retrospectively.

**Root cause #1**: The orchestrator didn't include INSTRUCTIONS.md content in sub-agent prompts.
**Root cause #2**: `.whygraph/INSTRUCTIONS.md` was never committed to git, so worktree sub-agents couldn't even find it.
**Root cause #3**: CLAUDE.md has no mention of whygraph, so sub-agents had zero awareness of decision capture.

## Changes

### 1. Commit `.whygraph/` repo-native files to git

**Files to commit** (these are meant to be repo-native per the README):
- `.whygraph/.gitignore`
- `.whygraph/INSTRUCTIONS.md`
- `.whygraph/config.json`
- `.whygraph/events.jsonl`

**Files that stay untracked** (per existing .gitignore):
- `staging/`, `sessions.json`, `errors.jsonl`, `.lock`, `.sessions-lock`, `uuid-map.json`

This is the critical fix. Once INSTRUCTIONS.md is tracked, every worktree gets it automatically.

**File**: `.whygraph/.gitignore` — update to explicitly allow the files that should be tracked:
```
staging/
sessions.json
errors.jsonl
reviews.jsonl
.lock
.sessions-lock
uuid-map.json
```

### 2. Add whygraph pointer to CLAUDE.md

Add a section to CLAUDE.md that tells all agents (including sub-agents) about decision capture:

```markdown
## Decision Capture

This project uses whygraph for architectural decision tracking. Before writing, modifying, or deleting code, read and follow `.whygraph/INSTRUCTIONS.md`. Write staging entries to `.whygraph/staging/` for every architectural choice you make — capture decisions in real-time as you work, not at the end of a session.
```

This is 3 lines. It propagates to every sub-agent because CLAUDE.md is automatically loaded. The pointer approach works because INSTRUCTIONS.md is now committed and available in worktrees.

**File**: `CLAUDE.md`

### 3. Add staging file naming guidance to INSTRUCTIONS.md

Currently INSTRUCTIONS.md says "write entries to `.whygraph/staging/`" but doesn't prescribe filenames. For concurrent sub-agents, naming collisions must be avoided.

Add to INSTRUCTIONS.md:

```markdown
### Staging File Naming

Name your staging file descriptively to avoid collisions with concurrent agents:
- If working on a tracked task: `staging/<task-id>.md` (e.g., `staging/issue-42.md`)
- If no task system: `staging/<descriptive-slug>.md` (e.g., `staging/auth-refactor.md`)
- Never use generic names like `staging/decisions.md` that multiple agents might target

Commit all staging files before ending your session.
```

**File**: `.whygraph/INSTRUCTIONS.md`

### 4. Add sub-agent propagation section to AGENT_INSTRUCTION_DESIGN.md

Document the pattern for whygraph developers and users. New section after "Platform Injection Architecture":

```markdown
## Sub-Agent Propagation

### The Problem

When an orchestrating agent spawns sub-agents (via Agent tool, worktrees, or similar
mechanisms), those sub-agents do not inherit:
- SessionStart hooks (hooks fire for the parent session only)
- Skills (on-demand workflows, not ambient)
- Any context beyond what the orchestrator explicitly provides

The only reliable automatic propagation mechanism is the project's instruction file
(CLAUDE.md in Claude Code, .cursor/rules/ in Cursor, etc.).

### The Solution: Pointer in Project Instructions

`whygraph init` adds a decision capture pointer to the project's instruction file.
This pointer propagates to all sub-agents automatically:

> Before writing, modifying, or deleting code, read and follow
> `.whygraph/INSTRUCTIONS.md`.

For this to work, `.whygraph/INSTRUCTIONS.md` must be committed to version control.
`whygraph init` handles this, but developers must ensure the commit happens before
spawning sub-agents in worktrees (worktrees only contain tracked files).

### Requirements for Reliable Sub-Agent Capture

1. `.whygraph/INSTRUCTIONS.md` is committed to git
2. The project instruction file contains the whygraph pointer
3. Staging files use distinct names to avoid collisions between concurrent agents
4. Sub-agents commit their staging files before their session ends

### What the Orchestrator Should Do

When spawning sub-agents for code modification tasks, the orchestrator does not need
to include INSTRUCTIONS.md content in the prompt — the CLAUDE.md pointer handles
this automatically. The orchestrator should:

1. Ensure uncommitted work is committed before creating worktrees
2. Assign distinct staging file names if multiple agents work concurrently
3. Merge worktree branches to collect staging files after agents complete
```

**File**: `docs/beads/AGENT_INSTRUCTION_DESIGN.md`

### 5. Update `whygraph init` requirements (future bead)

The init command (not yet built) should:
- Append the decision capture section to the project's instruction file (CLAUDE.md, .cursor/rules/whygraph.md, etc.)
- Ensure `.whygraph/INSTRUCTIONS.md` and `.whygraph/config.json` are `git add`ed
- Warn: "Commit these files before spawning sub-agents in worktrees"
- Detect existing whygraph sections to avoid duplication on re-init

This is design input for bead 10 (CLI: init command), not immediate implementation.

## Files Modified

| File | Change |
|------|--------|
| `CLAUDE.md` | Add 3-line decision capture pointer section |
| `.whygraph/INSTRUCTIONS.md` | Add staging file naming guidance (~8 lines) |
| `.whygraph/.gitignore` | Ensure reviews.jsonl is listed (currently missing) |
| `docs/beads/AGENT_INSTRUCTION_DESIGN.md` | Add sub-agent propagation section (~40 lines) |

## Files Committed (git add)

| File | Reason |
|------|--------|
| `.whygraph/.gitignore` | Repo-native, controls what's tracked |
| `.whygraph/INSTRUCTIONS.md` | Repo-native, must be in worktrees |
| `.whygraph/config.json` | Repo-native, project configuration |
| `.whygraph/events.jsonl` | Repo-native, the decision graph itself |

## Verification

1. After committing, create a test worktree: `git worktree add /tmp/test-wt -b test-wt`
2. Verify `/tmp/test-wt/.whygraph/INSTRUCTIONS.md` exists
3. Verify `/tmp/test-wt/CLAUDE.md` contains the decision capture pointer
4. Clean up: `git worktree remove /tmp/test-wt`

## What This Does NOT Solve

- **Compliance**: Sub-agents may still ignore the instructions. This is the "compliance boundary" documented in AGENT_INSTRUCTION_DESIGN.md — whygraph guarantees delivery, not compliance. Better instructions produce better compliance.
- **Decision quality**: Backfilled decisions are lower quality than real-time ones. This plan prevents the need for backfilling by ensuring sub-agents have the framework from the start.
- **Orchestrator prompt quality**: If an orchestrator writes a poor sub-agent prompt that overwhelms the CLAUDE.md pointer with other instructions, decision capture may be deprioritized. This is inherent to the prompt-based control model.
