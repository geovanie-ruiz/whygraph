# Agent Instruction Design

How whygraph teaches agents to capture decisions — the design behind the prompts
that ship with the tool.

## Design Principle: Opinionated on What, Agnostic on When

Whygraph is opinionated about:

- **What to capture**: The 9-category recognition heuristic (see DECISION_STANDARD.md).
  If agents don't recognize decisions, the tool doesn't work.
- **What to write**: Decision files with context/decision/tradeoffs/alternatives.
  This structure is what makes decisions queryable, visualizable, and useful.
- **Entry quality**: Tradeoffs must name costs. Alternatives must explain why rejected.
  Context must explain the pressure that created the fork.

Whygraph is agnostic about:

- **When to capture**: TDD cycles, post-commit, mid-conversation, during review —
  whygraph doesn't prescribe workflow. The universal trigger is "you just wrote or
  changed code."
- **Development methodology**: TDD, trunk-based, feature branches, mob programming —
  doesn't matter. Decisions happen in all of them.
- **Task tracking**: Beans, GitHub issues, Linear, Jira, sticky notes — whygraph
  doesn't care how work is organized. It cares about the decisions made during work.
- **Agent platform**: Claude Code, Cursor, Copilot, or something that doesn't exist
  yet. The file format and MCP interface are the universal contract.

## How Whygraph Injects Itself

The decision framework is delivered to agents via platform-specific injection points.
Each platform's mechanism contains a pointer to whygraph's instructions. The agent
reads the instructions when it's about to modify code.

This is the mechanism. There is no fallback loop, no remediation phase, no second
pass. If the instructions are clear enough, the agent complies. If they're not,
the instructions need to be improved.

### Compliance Boundaries

Whygraph can guarantee instruction delivery — every supported platform has a
mechanism to put the pointer in the agent's context before coding starts. Whygraph
cannot guarantee instruction compliance — the agent may read the instructions and
still produce incomplete or low-quality decisions.

Whygraph should be transparent about this: the tool provides the framework, the
recognition heuristic, the file format, and the delivery mechanism. The quality
of decision capture depends on the agent's compliance with the instructions.

## Two Distinct Flows

**Flow 1: Agent working on code (primary)**
The agent reads instructions, captures decisions in real-time as it works, writes
decision files to `.whygraph/graph/`. The whygraph server detects new files via
file watchers and updates the graph immediately. This is the normal operating mode.

**Flow 2: Human-driven onboarding (`/whygraph-interview`)**
A developer installs whygraph on an existing codebase. The interview skill walks
through areas with no recorded decisions (gaps) and helps the developer
retroactively capture rationale. This data is inherently lower quality —
reconstructed rather than captured in the moment. This flow exists for onboarding,
not as a safety net for Flow 1.

These flows do not interact.

## The Agent Instruction Set

### 1. Capture Decisions (The Core Instruction)

This instruction must accomplish three things:

**Teach recognition.** Agents must learn to notice when they're making a decision.
The 9-category heuristic from DECISION_STANDARD.md is the framework.

**Be directive, not advisory.** The instructions tell the agent what to do, not
what it might consider doing. "Write a decision file for each architectural choice"
is a directive. "Consider capturing decisions as you work" is advisory. The former
produces compliance; the latter produces optional behavior.

**Teach quality.** Context explains pressure. Decision explains implementation.
Tradeoffs name costs. Alternatives explain rejections. Each field has a purpose and
a quality bar.

### 2. Map New Code

When creating new files or modules, write structural node files (Feature or
Component) to `.whygraph/graph/`.

### 3. Remove Deleted Code

When deleting a module or feature, set `removed_at` on the corresponding node file.
The server handles cascade removal (child components and orphaned decisions).

### 4. Update Refs

When renaming or moving code, update the `refs` field in the affected node file.

### 5. Query Before Modifying

Call `whygraph_context(file)` via MCP to understand existing constraints before
making changes. Respect existing decisions.

### 6. Verify Server

At session start, verify the whygraph server is running. If not, prompt the user
to start it or start it with permission.

## The Interview Skill

`/whygraph-interview` is a human-driven onboarding tool for existing codebases. It
is NOT a remediation mechanism for poor agent capture.

The agent queries the graph for gaps (nodes with no decisions), then walks through
them with the developer. The interviewer must probe specifically:

Good interview questions:

- "What conventions did you follow here? Why those conventions?"
- "What configuration options did you consider?"
- "What did you choose NOT to do? What did you explicitly leave out?"
- "If you were explaining this to a new team member, what would surprise them?"
- "What would go wrong if someone changed this to [alternative]?"

Bad interview questions:

- "What decisions did you make?" (too broad, invites "I don't know")
- "Why did you build it this way?" (invites "it was obvious")

## Platform Injection Architecture

Each platform has a structural injection point — a mechanism that guarantees the
pointer is in the agent's context.

### Claude Code — Hooks + CLAUDE.md

**SessionStart hook**: Checks if whygraph server is running, prompts user to start
it if not. Outputs the decision capture pointer.

**CLAUDE.md pointer**: "Before writing, modifying, or deleting code, read and follow
whygraph's agent instructions." Propagates to sub-agents via CLAUDE.md inheritance.

**Skills**: `/whygraph-interview` for onboarding existing codebases.

### Cursor — Rules

**`.cursor/rules/whygraph.md`**: Contains the decision capture instructions.
`whygraph init` writes this file.

**Warning**: Developer is responsible for ensuring the pointer survives if
`.cursor/rules/` is regenerated.

### Copilot — Instructions

**`.github/copilot-instructions.md`**: `whygraph init` appends the pointer.

**Warning**: Same as Cursor — developer must preserve the pointer.

### Other Platforms

Developer configures their agent harness to deliver the instructions using
whatever mechanism their platform supports.

## Sub-Agent Propagation

When an orchestrating agent spawns sub-agents in worktrees, those sub-agents get
a full copy of `.whygraph/` (all files are git-tracked). The CLAUDE.md pointer
propagates to sub-agents, directing them to read the instructions.

The whygraph server (running on the main repo) detects worktree directories and
watches them for changes. Decisions written by sub-agents are visible in the graph
immediately as "dirty" state. When the worktree branch merges, the files become
part of the main branch and the dirty flags clear.

Requirements for reliable sub-agent capture:

1. All whygraph state is git-tracked (so worktrees have it)
2. The platform's instruction file contains the whygraph pointer
3. Decision files use distinct IDs (NanoID prevents collisions)
4. Sub-agents commit decision files before ending their session
