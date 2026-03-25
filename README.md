# Whygraph

**The graph of why. So your agent knows before it touches anything.**

Whygraph captures the architectural rationale behind your codebase — the decisions, tradeoffs, and rejected alternatives — and makes it queryable by AI agents before they write a single line.

---

## The Problem

You're vibe-coding. The agent is fast. Features ship in minutes. Then three sessions later, it confidently rebuilds something you already tried and abandoned. It re-introduces the pattern you explicitly rejected. It optimizes for the local signal — passing tests, satisfying the prompt — while losing the thread of why the architecture is shaped the way it is.

This isn't a hallucination problem. It's a memory problem. The agent isn't wrong. It just doesn't know the why.

---

## What It Is

Whygraph is a **decision graph** — markdown files with YAML frontmatter stored in `.whygraph/graph/`, projected at runtime into a queryable graphology graph. It models your application as a hierarchy of nodes (app → features → components) with decisions attached to the nodes they affect.

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

## Getting Started

```bash
npm install --save-dev whygraph
npx whygraph init
npx whygraph up
```

`whygraph init` walks you through environment selection, creates the `.whygraph/` directory, registers the MCP server, and writes agent instructions to CLAUDE.md (Claude Code) or AGENTS.md (all other platforms).

`whygraph up` starts the server in the background. The server watches `.whygraph/graph/` for changes, maintains an in-memory graph, and serves the GraphQL API and frontend visualization.

From there, agents capture decisions automatically as they work.

---

## Platform Integration

Whygraph is **platform-agnostic**. It works with any AI development environment.

| Platform    | Instruction Delivery | MCP Server | Agent Instructions |
| ----------- | -------------------- | ---------- | ------------------ |
| Claude Code | CLAUDE.md            | Auto-registered in `.claude/settings.json` | Full MCP tool access |
| Cursor      | AGENTS.md            | Manual configuration | Direct file writes |
| Copilot     | AGENTS.md            | Manual configuration | Direct file writes |
| Other       | AGENTS.md            | Manual configuration | Direct file writes |

**Claude Code** gets the deepest integration: MCP server auto-registration, write tools in strict mode with fallback to direct file writes, and instructions baked into CLAUDE.md.

**All other platforms** get instructions in AGENTS.md (the emerging cross-tool standard). Decision capture works via direct file writes to `.whygraph/graph/`.

---

## How It Works

### Decision Capture

Agents capture decisions as they work. The instructions in CLAUDE.md / AGENTS.md teach agents to recognize decisions — not just explicit forks ("should I use X or Y?") but also conventions, configuration choices, deliberate omissions, and tradeoffs.

**MCP Mode (strict):** Agent calls MCP tools → server validates → writes to disk. If the server is unreachable, falls back to direct file writes.

**Default mode:** Agent writes decision files directly to `.whygraph/graph/`. The file watcher picks them up, validates, and creates issue sidecars for any problems.

### The Server

The whygraph server is a long-running process that:
- Watches `.whygraph/graph/` for file changes (chokidar, 100ms debounce)
- Maintains an in-memory graphology graph
- Serves a GraphQL API (queries, mutations, subscriptions via WebSocket)
- Serves a React frontend with D3 force-directed graph visualization
- Detects and watches git worktrees for multi-agent support
- Reconciles entity validation issues on startup and per file change

### Issue Sidecars

When an entity has validation problems (bad refs, missing fields, schema violations), whygraph creates a JSON sidecar in `.whygraph/issues/<entity-id>.json`. The entity data is preserved — issues are tracked separately. On startup, the server reconciles all issues: creating sidecars for problems, deleting them when entities pass validation.

### The MCP Server

Whygraph exposes MCP tools for agent integration:

| Tool | Description |
| ---- | ----------- |
| `whygraph_context(file, symbol?)` | Get decisions for code you're about to modify |
| `whygraph_get_decisions(filters)` | Query decisions by status, tags, date range |
| `whygraph_get_gaps(limit?)` | Find areas with no recorded decisions |
| `whygraph_list_nodes(filters)` | List structural nodes |
| `whygraph_create_decision(...)` | Create a decision (strict mode) |
| `whygraph_create_node(...)` | Create a structural node (strict mode) |

Write tools are available in strict mode (`WHYGRAPH_MCP_MODE=strict`). They validate before writing and fall back to direct file writes if the server is unreachable.

### The Visualization

`whygraph viz` opens a browser to the frontend at `http://localhost:4777`. The visualization features:
- D3 force-directed graph with deterministic seeded layout
- App node pinned at center, everything radiates outward
- Live updates via WebSocket subscriptions
- Timeline scrubber for temporal projection
- Tag filtering, gap highlighting, stale ref badges
- Theme toggle (dark/light)

---

## CLI

```bash
whygraph init                    # Set up whygraph for your project
whygraph up                      # Start the server in the background
whygraph down                    # Stop the server
whygraph restart                 # Stop and restart the server
whygraph status                  # Check server status and entity counts
whygraph viz [--no-open]         # Open the visualization
whygraph config [--flag val]     # View or modify configuration
whygraph validate                # Validate all entities
whygraph mcp                     # Start the MCP stdio server
```

---

## Graph Schema

**Node Types**: `App`, `Feature`, `Component`, `Decision`

**Edge Types**: `COMPOSES` (structural hierarchy), `AFFECTS` (decision → node), `SUPERSEDES` (decision → decision)

**Decision Properties**: title, date, context, decision, tradeoffs, alternatives, status, affects, tags

**Tags** (fixed taxonomy): `arch`, `data`, `security`, `performance`, `integration`, `infra`, `ux`

---

## Multi-Agent / Worktree Support

Whygraph runs one server per repo, watching all git worktrees. When agents work in separate worktrees:
- Each worktree's `.whygraph/graph/` is watched independently
- ETag-based dirty tracking detects divergence from the main graph
- Entity IDs use NanoIDs to prevent collisions across concurrent agents
- Conflict resolution happens at git merge time (standard git workflow)

---

## Design Principles

**The why is not in the code.** You can read a codebase and understand what it does. You cannot read it and understand what was tried before, what was rejected, and what trade-offs were accepted.

**Decisions, not documentation.** Structured decision records — context, choice, tradeoffs, alternatives — not prose. This structure is what makes decisions queryable.

**Append-only.** Superseded decisions stay in the graph. They explain the path, not just the destination.

**Repo-native.** The graph lives in your repo, versioned with your code. No external service, no account required.

**Agent-first.** The MCP interface and CLAUDE.md/AGENTS.md instructions are the primary interfaces. The CLI and visualization exist so humans can inspect what agents will read.

**Never lose data.** Entity files are always written, even if validation fails. Issues are tracked in sidecars, not by rejecting writes.

**Platform-agnostic.** Whygraph works with any AI development environment. Deep integration with specific platforms is additive, not required.

---

## Acknowledgments

Special thanks to:

- **[Matt Pocock](https://www.youtube.com/@mattpocockuk)** — the development skills used in this project (TDD, simplify, PRD writing, and others) are based on his [5 Skills for Claude Code](https://www.youtube.com/watch?v=EJyuu6zlQCg) workflow

## License

MIT
