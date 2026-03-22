# Whygraph

**The graph of why. So your agent knows before it touches anything.**

Whygraph is a repo-native decision graph that captures the architectural rationale behind your codebase — and makes it queryable by AI agents before they write a single line.

---

## The Problem

You're vibe-coding. The agent is fast. Features ship in minutes. Then three sessions later, it confidently rebuilds something you already tried and abandoned. It re-introduces the pattern you explicitly rejected. It optimizes for the local signal — passing tests, satisfying the prompt — while losing the thread of why the architecture is shaped the way it is.

This isn't a hallucination problem. It's a memory problem. The agent isn't wrong. It just doesn't know the why.

Your CLAUDE.md has conventions. Beads has tasks. Your codebase has structure. But none of them carry rationale. None of them answer the question an agent actually needs answered before acting:

> _Why is this shaped the way it is, and what did we try before this?_

That's what Whygraph is for.

---

## What It Is

Whygraph is a **decision graph** — a lightweight, append-only graph stored as `.whygraph/graph.jsonl` in your repo. It models your application as a hierarchy of nodes (app → features → components) connected by edges. Decisions attach to the nodes they affect, recording context, rationale, trade-offs, and rejected alternatives.

```
App
├── Feature: Auth
│   ├── Component: Session Management
│   │   └── [AUTH-001] JWT over sessions
│   └── Component: Token Refresh
│       └── [AUTH-002] Silent refresh via interceptor
└── Feature: API Layer
    ├── Component: Rate Limiting
    │   └── [API-001] Redis-backed sliding window
    └── [API-002] REST over tRPC
```

Every decision has a date. The graph is the temporal history of your architecture — not just what it is now, but how it got here and why.

---

## How It Works

### The Graph Schema

Four node types. Three edge types. That's it.

**Nodes**

| Type        | Description                                              |
| ----------- | -------------------------------------------------------- |
| `App`       | Root node. One per project.                              |
| `Feature`   | A user-facing capability (e.g. "Auth", "Billing")        |
| `Component` | An implementation unit within a feature                  |
| `Decision`  | A recorded architectural fork with context and rationale |

**Edges**

| Type         | Description                                                     |
| ------------ | --------------------------------------------------------------- |
| `COMPOSES`   | `App → Feature`, `Feature → Component`, `Component → Component` |
| `AFFECTS`    | `Decision → Feature` or `Decision → Component`                  |
| `SUPERSEDES` | `Decision → Decision` (temporal chain)                          |

**Decision Properties**

```typescript
type Decision = {
  id: string; // e.g. "AUTH-001"
  title: string;
  date: string; // ISO 8601
  context: string; // Why this decision was needed
  decision: string; // What was chosen and how it was implemented
  tradeoffs: string; // What was gained vs. given up
  alternatives: string; // Other approaches considered and why they were rejected
  status: "active" | "superseded" | "deprecated";
  affects: string[]; // Node IDs this decision touches
  supersedes?: string; // Decision ID this replaces
};
```

### The Storage Format

`.whygraph/graph.jsonl` — one JSON object per line, one line per node or edge.

```jsonl
{"type":"node","label":"App","id":"app","properties":{"name":"MyApp"}}
{"type":"node","label":"Feature","id":"feat-auth","properties":{"name":"Auth"}}
{"type":"node","label":"Component","id":"comp-session","properties":{"name":"Session Management"}}
{"type":"edge","label":"COMPOSES","from":"app","to":"feat-auth"}
{"type":"edge","label":"COMPOSES","from":"feat-auth","to":"comp-session"}
{"type":"node","label":"Decision","id":"AUTH-001","properties":{"title":"JWT over sessions","date":"2025-03-01","context":"API is stateless by design; session state would require sticky routing or shared Redis","decision":"JWTs with 15m expiry and silent refresh. Tokens signed with RS256.","tradeoffs":"Gained: stateless scaling, simple horizontal deployment. Lost: instant revocation requires a denylist.","alternatives":"Server-side sessions (rejected: shared state), opaque tokens (rejected: DB lookup per request)","status":"active","affects":["comp-session","comp-token-refresh"]}}
{"type":"edge","label":"AFFECTS","from":"AUTH-001","to":"comp-session"}
```

This format is git-friendly (line-level diffs), agent-readable (parseable without loading everything), and human-inspectable (`cat .whygraph/graph.jsonl | jq`).

Decisions are **never deleted**. A superseded decision stays in the graph — it explains why the current structure replaced what came before. The history is the point.

### The MCP Server

Whygraph exposes a lightweight MCP server so Claude Code and any MCP-compatible agent can query the graph before acting.

```json
// .claude/mcp.json
{
  "mcpServers": {
    "whygraph": {
      "command": "npx",
      "args": ["whygraph-mcp"]
    }
  }
}
```

**Available tools**

| Tool                     | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `whygraph_get_feature`   | Get a feature node and all decisions that affect it          |
| `whygraph_get_decisions` | Query decisions by feature, component, date range, or status |
| `whygraph_get_history`   | Get the full decision chain for a node, ordered by date      |
| `whygraph_get_subgraph`  | Get a subgraph rooted at a given node, bounded by depth      |
| `whygraph_add_decision`  | Write a new decision record to the graph                     |
| `whygraph_supersede`     | Mark a decision superseded and link the replacement          |

### Add This to Your CLAUDE.md

```markdown
## Architectural Memory

This project uses Whygraph for architectural decision tracking. Before modifying
any feature or component, query the Whygraph MCP server:

whygraph_get_feature("<feature-name>")

This returns the structural context and rationale for that area of the codebase.
Do not contradict an active decision without first recording a new one that
supersedes it. If you are unsure whether your approach conflicts with an existing
decision, call whygraph_get_decisions before proceeding.
```

---

## The Timeline

Every decision has a date. `whygraph timeline` renders a point-in-time snapshot of the graph — what did the architecture look like before a given decision was made?

```bash
whygraph timeline --at 2025-02-15
whygraph timeline --before AUTH-003
```

This is how you answer "why did this become so complicated?" — replay the sequence of decisions that produced the current structure, one fork at a time.

---

## Getting Started

```bash
npm install -g whygraph
cd your-project
whygraph init
```

`whygraph init` creates `.whygraph/graph.jsonl` with your app root node and walks you through defining your top-level features. From there, decisions can be added via CLI or directly by your agent through the MCP server.

```bash
# Add a decision
whygraph add --feature auth --title "JWT over sessions" --id AUTH-001

# View the current graph
whygraph graph

# Query decisions for a feature
whygraph decisions --feature auth

# Show the full timeline
whygraph timeline
```

---

## Design Principles

**The why is not in the code.** You can read a codebase and understand what it does. You cannot read it and understand what was tried before, what was rejected, and what trade-offs were accepted. That knowledge lives in people's heads, decays across sessions, and disappears entirely when an agent starts fresh.

**Ground truth over inference.** Whygraph records what was actually decided. An agent reading the graph gets the rationale, not a reconstruction of it. This is the distinction between memory and hallucination.

**Append-only.** The history is the product. Decisions that get superseded stay in the graph — they explain the path, not just the destination.

**Repo-native.** The graph lives in your repo, versioned with your code. When you branch, the graph branches. When you merge, it merges. No external service, no account required.

**Minimal friction.** A decision that takes five minutes to write won't get written. Context, decision, trade-offs, alternatives. That's the whole schema.

**Agent-first.** The MCP interface is the primary interface. The CLI and visualization exist so humans can inspect what the agent will read.

---

## How Whygraph Fits

| Tool               | What it stores                           | Whygraph's relationship                                       |
| ------------------ | ---------------------------------------- | ------------------------------------------------------------- |
| **Beads**          | Task execution state (what to do next)   | Complementary — Beads tracks tasks, Whygraph tracks rationale |
| **CLAUDE.md**      | Conventions and behavioral rules         | Complementary — CLAUDE.md is the how, Whygraph is the why     |
| **Code-Graph-RAG** | Code structure (what exists)             | Complementary — structural map vs. decision history           |
| **Structurizr**    | Architecture diagrams + ADR viewer       | Human-facing; not agent-queryable                             |
| **Warp Drive**     | Shared workflows and operational context | Different layer — procedures, not rationale                   |

---

## Status

Early development. The JSONL schema and MCP tool interface are stable. CLI and visualization are in progress.

Contributions welcome — especially:

- MCP server robustness and query optimization
- CI integration (flag PRs that touch features with active decisions)
- Visualization of the temporal graph
- Import from existing ADR markdown formats (adr-tools, MADR, log4brains)

---

## Why Whygraph

Because the only question that matters before an agent touches your codebase is the one no other tool answers.

---

## License

MIT

GIVING THANKS: MERGE THIS INTO README IN A PROPER FORMAT
MATT POCOCK YT: https://www.youtube.com/@mattpocockuk
REFERENCE VIDEO FOR 5 SKILLS: https://www.youtube.com/watch?v=EJyuu6zlQCg
