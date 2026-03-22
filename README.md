# Whygraph

**The graph of why. So your agent knows before it touches anything.**

Whygraph is a developer tool that captures the architectural rationale behind your codebase — the decisions, tradeoffs, and rejected alternatives — and makes it queryable by AI agents before they write a single line.

It integrates with your development environment to teach agents how to recognize and record decisions as they work, so the _why_ behind your architecture is never lost.

---

## The Problem

You're vibe-coding. The agent is fast. Features ship in minutes. Then three sessions later, it confidently rebuilds something you already tried and abandoned. It re-introduces the pattern you explicitly rejected. It optimizes for the local signal — passing tests, satisfying the prompt — while losing the thread of why the architecture is shaped the way it is.

This isn't a hallucination problem. It's a memory problem. The agent isn't wrong. It just doesn't know the why.

Your CLAUDE.md has conventions. Your task tracker has tickets. Your codebase has structure. But none of them carry rationale. None of them answer the question an agent actually needs answered before acting:

> _Why is this shaped the way it is, and what did we try before this?_

That's what Whygraph is for.

---

## What It Is

Whygraph is a **decision graph** — an append-only event log stored as `.whygraph/events.jsonl` in your repo, projected at runtime into a queryable graph. It models your application as a hierarchy of nodes (app → features → components) with decisions attached to the nodes they affect.

```text
App: MyProject
├── Feature: Auth
│   ├── Component: Session Management
│   │   └── ◆ JWT over sessions (active)
│   └── Component: Token Refresh
│       └── ◆ Silent refresh via interceptor (active)
└── Feature: API Layer
    ├── Component: Rate Limiting
    │   └── ◆ Redis-backed sliding window (active)
    └── ◆ REST over tRPC (active)
```

Every decision records context (why it was needed), the choice made, tradeoffs accepted, and alternatives rejected. Decisions are never deleted — a superseded decision stays in the graph, explaining how the architecture evolved.

---

## Platform Integration

Whygraph is **platform-agnostic**. It's distributed as an npm package and works with any AI development environment. When installed in a supported environment, it integrates deeply with that platform's agent infrastructure.

**Claude Code** gets first-class integration: session hooks for automatic sync, skills for codebase scanning and decision interviews, and a durable instruction pointer via SessionStart hooks. Whygraph functions as a Claude Code plugin in this environment.

**Cursor, Copilot, and other environments** get baseline integration: pointer files in the platform's instruction location (`.cursor/rules/`, `.github/copilot-instructions.md`), git hooks for sync on commit, and prompt files for scan/interview workflows.

**Unsupported environments** get the agnostic baseline: `.whygraph/INSTRUCTIONS.md` contains the full decision framework, and `whygraph init` tells the developer how to configure their agent to read it before modifying code.

The architecture supports equal integration depth on any platform. Claude Code is deepest because it's where development started — other platforms will get deeper integration over time.

| Platform    | Instruction Delivery              | Sync Trigger        | Durability                         |
| ----------- | --------------------------------- | ------------------- | ---------------------------------- |
| Claude Code | SessionStart hook                 | Hook on session end | Durable — independent of CLAUDE.md |
| Cursor      | `.cursor/rules/whygraph.md`       | Git hook on commit  | Developer must preserve            |
| Copilot     | `.github/copilot-instructions.md` | Git hook on commit  | Developer must preserve            |
| Other       | Manual configuration              | Manual CLI          | Developer manages                  |

---

## How It Works

### Architecture: Event Sourcing + Graph Projection

The event log (`.whygraph/events.jsonl`) is the append-only source of truth. Every graph mutation — adding a node, creating an edge, patching a property — is a timestamped event. The runtime graph is a `graphology.MultiDirectedGraph` rebuilt by replaying the event log on every read.

This means temporal replay is free: `buildGraphAt(events, cutoff)` replays a subset of events to show the graph at any point in history.

### Decision Capture

Agents capture decisions as they work. `.whygraph/INSTRUCTIONS.md` teaches agents to recognize decisions — not just explicit forks ("should I use X or Y?") but also:

- Conventions followed that a future agent might not know
- Configuration choices that exclude alternatives
- Data modeling decisions with downstream consequences
- Deliberate omissions (choosing NOT to do something)
- Inventions not in the requirements

The instructions are directive: "Write a staging entry for every architectural choice." Agents write structured entries to `.whygraph/staging/` which are processed into events by `whygraph sync`.

### The MCP Server

Whygraph exposes 5 read-only MCP tools:

| Tool                              | Description                                                   |
| --------------------------------- | ------------------------------------------------------------- |
| `whygraph_context(file, symbol?)` | Get decisions and constraints for code you're about to modify |
| `whygraph_get_decisions(filters)` | Query decisions by status, tags, date range                   |
| `whygraph_get_gaps(limit?)`       | Find areas with no recorded decisions                         |
| `whygraph_get_reviews()`          | Get pending supersede candidates                              |
| `whygraph_get_errors()`           | Get failed staging entries                                    |

All writes go through staging files — the MCP server is read-only.

### The Visualization

`whygraph viz` generates a self-contained HTML file with an interactive force-directed D3 graph. Timeline scrubber replays the architecture's evolution. Tag filtering slices by concern (arch, data, security, performance, integration, infra, ux). Focus+context navigation lets you drill into any subtree. Side panels show full decision details.

The HTML works offline, opens via `file://`, and is committable to the repo.

---

## Getting Started

```bash
npm install --save-dev whygraph
npx whygraph init
```

`whygraph init` walks you through environment selection and creates the `.whygraph/` directory with all required files. It configures platform-specific hooks and instruction delivery based on your environment.

After init, run `/whygraph-scan` in your agent to map your codebase's feature/component structure. Then run `/whygraph-interview` to capture historical decisions from your mental model.

From there, agents capture decisions automatically as they work.

---

## CLI

```bash
whygraph init              # Set up whygraph for your project
whygraph sync [--flush]    # Process staging files into events
whygraph viz [--no-open]   # Generate the visualization
whygraph config --flag val # Modify preferences
whygraph mcp               # Start the MCP stdio server
```

---

## Graph Schema

**Node Types**: `App`, `Feature`, `Component`, `Decision`

**Edge Types**: `COMPOSES` (structural hierarchy), `AFFECTS` (decision → node), `SUPERSEDES` (decision → decision), `DEPRECATES` (node → node)

**Decision Properties**: title, date, context, decision, tradeoffs, alternatives, status, affects, tags

**Tags** (fixed taxonomy): `arch`, `data`, `security`, `performance`, `integration`, `infra`, `ux`

---

## Design Principles

**The why is not in the code.** You can read a codebase and understand what it does. You cannot read it and understand what was tried before, what was rejected, and what trade-offs were accepted. That knowledge decays across sessions and disappears when an agent starts fresh.

**Decisions, not documentation.** Whygraph captures structured decision records — context, choice, tradeoffs, alternatives — not prose. This structure is what makes decisions queryable and visualizable.

**Append-only.** The history is the product. Superseded decisions stay in the graph. They explain the path, not just the destination.

**Repo-native.** The graph lives in your repo, versioned with your code. No external service, no account required.

**Agent-first.** The MCP interface and INSTRUCTIONS.md are the primary interfaces. The CLI and visualization exist so humans can inspect what agents will read.

**Platform-agnostic.** Whygraph works with any AI development environment. Deep integration with specific platforms is additive, not required.

---

## Status

Early development. Core architecture (event log, projection, types) is implemented. Staging pipeline, CLI, MCP server, and visualization are in progress.

---

## Acknowledgments

Special thanks to:

- **[Matt Pocock](https://www.youtube.com/@mattpocockuk)** — the development skills used in this project (TDD, simplify, PRD writing, and others) are based on his [5 Skills for Claude Code](https://www.youtube.com/watch?v=EJyuu6zlQCg) workflow

## License

MIT
