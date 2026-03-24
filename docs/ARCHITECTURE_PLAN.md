# Whygraph Architecture Plan

> Pre-PRD design exploration. This document captures everything needed to write the PRD.
> Grill this document until there are no gaps, then convert to PRD and break into beans.

## 1. What We Learned

### From the POC

The POC proved that decision capture works — agents can write decisions, a graph can be projected from them, and MCP tools can query the graph to inform future work. The core query semantics (`getContext`, `getDecisions`, `getGaps`) are sound and worth preserving.

What broke:
- **JSONL as source of truth** — append-only single file creates merge conflicts, can't survive parallel worktree agents
- **Staging-then-delete pipeline** — staging files are gitignored and ephemeral, decisions are lost when worktrees are cleaned up
- **Gitignored critical state** — `uuid-map.json`, `staging/`, `reviews.jsonl`, `sessions.json` don't replicate to worktrees
- **No live feedback** — static HTML bake with stale banners is a workaround, not a solution
- **Read-only MCP** — agents must write markdown files and hope sync works, no direct creation path

What worked:
- **Graphology as the runtime graph** — no parallel data structures, compositional queries
- **Pure functions for graph operations** — `query.ts`, `projection.ts` are testable and side-effect free
- **Rich decision properties** — ADR structure (context, decision, tradeoffs, alternatives) captures the full "why"
- **Error collection over early throw** — partial success beats total failure
- **Type-first design** — types are the spec, code implements to types

### From Beans

Beans solved the exact problems we're facing. Key patterns:

- **One file per entity, committed to git** — merge-friendly by design, worktree-safe because git checkout replicates tracked files
- **Long-running server with file watchers** — parse once on startup, stay current via fsnotify, queries hit in-memory map
- **Worktree watcher with dirty tracking** — server watches all worktree `.beans/` directories, merges changes into runtime state, ETag-based diffing prevents stale overrides
- **WebSocket subscriptions for live frontend** — no polling, no stale banners, INITIAL_SNAPSHOT pattern eliminates subscribe-then-query race
- **Single GraphQL endpoint** — queries, mutations, subscriptions through one API surface
- **Worktrees stored outside the repo** — avoids nested repo issues and `.gitignore` complexity
- **Agent spawning as subprocess** — Claude Code runs as a long-running process with stream-json protocol, sessions are resumable
- **Forge abstraction** — GitHub-specific operations behind an interface

## 2. Architecture

### 2.1 Server

Long-running Node.js HTTP server. Starts on `whygraph serve` or auto-starts on first MCP/CLI call.

**Startup sequence:**
1. Walk `.whygraph/nodes/` and `.whygraph/decisions/` — parse all files into in-memory maps
2. Build graphology `MultiDirectedGraph` from parsed state
3. Start file watcher (chokidar) on `.whygraph/`
4. Detect and watch active worktree `.whygraph/` directories
5. Start HTTP server (API + WebSocket + frontend)

**Runtime behavior:**
- File watcher fires on changes → incremental parse of changed file → update in-memory map → update graph → push event to WebSocket subscribers
- Worktree changes merged as "dirty" (not persisted to main repo disk)
- ETag-based diffing between worktree and main versions — clear worktree link when versions match (post-rebase)

**API surface — two options to evaluate:**

Option A: **GraphQL** (beans pattern)
- Single `/api/graphql` endpoint for queries, mutations, subscriptions
- Schema-driven, type-safe, self-documenting
- Subscriptions via WebSocket transport built into GraphQL
- Frontend uses urql or Apollo client
- Adds dependency (graphql-yoga or mercurius for Node)

Option B: **REST + WebSocket**
- JSON API endpoints (`/api/nodes`, `/api/decisions`, `/api/context`, etc.)
- Separate WebSocket endpoint for live updates
- Simpler to implement, no schema layer
- Frontend uses fetch + native WebSocket
- More endpoints to maintain, less self-documenting

Beans chose GraphQL and it simplified their API surface enormously. One endpoint, one schema, subscriptions built in. The INITIAL_SNAPSHOT pattern (subscription delivers initial state + subsequent changes) eliminates race conditions.

### 2.2 Data Model

#### Decision files

One markdown file per decision in `.whygraph/decisions/`.

```
.whygraph/decisions/<short-id>--<slug>.md
```

```yaml
---
# wg-a1b2
id: wg-a1b2
title: Use WebSockets for live graph updates
status: active          # draft | active | superseded | rejected
date: 2026-03-23
affects:                # node IDs this decision touches
  - wg-n-viz
  - wg-n-server
tags: [arch, integration]
supersedes: wg-d-x9y8   # optional — decision this replaces
created_at: 2026-03-23T10:00:00Z
updated_at: 2026-03-23T10:00:00Z
---

## Context
The baked HTML viz requires manual refresh and shows a stale banner...

## Decision
Use WebSocket subscriptions from the server to push graph state changes...

## Tradeoffs
Gained: real-time updates, no stale state, immediate feedback...
Lost: requires a running server, WebSocket connection management...

## Alternatives
- Polling (rejected: latency, unnecessary load)
- Server-Sent Events (rejected: unidirectional, no subscription semantics)
```

**ID generation:** NanoID with `[0-9a-z]` alphabet, 4 characters, configurable prefix (e.g., `wg-`). Same pattern as beans.

**File naming:** `<id>--<slug>.md` with double-dash separator. ID extracted from filename at parse time. ID comment in front matter for visibility.

#### Structural node files

One file per node (App, Feature, Component) in `.whygraph/nodes/`.

```
.whygraph/nodes/<short-id>--<slug>.md
```

```yaml
---
# wg-n-auth
id: wg-n-auth
label: Feature           # App | Feature | Component
name: Authentication
parent: wg-n-app         # parent node ID (App for features, Feature/Component for components)
status: active           # active | deprecated
refs:                    # code references
  - file: src/auth/index.ts
  - file: src/auth/session.ts
    symbol: createSession
created_at: 2026-03-22T00:00:00Z
updated_at: 2026-03-22T00:00:00Z
---

Optional markdown body for description or notes.
```

#### What's git-tracked vs gitignored

**Git-tracked (survives worktrees, merges cleanly):**
- `.whygraph/nodes/*.md` — structural graph
- `.whygraph/decisions/*.md` — decision records
- `.whygraph/config.json` — project configuration

**Gitignored (runtime state, derived or ephemeral):**
- `.whygraph/.cache/` — optional performance cache (graph snapshot, etc.)
- `.whygraph/.server/` — PID file, port file, logs
- Nothing critical. If `.whygraph/` is deleted except tracked files, everything rebuilds from the markdown files.

### 2.3 Graph Projection

The in-memory graph is built from node files + decision files:

1. Parse all node files → create graph nodes with attributes
2. Create COMPOSES edges from parent references
3. Parse all decision files → create Decision nodes with attributes
4. Create AFFECTS edges from decision `affects` references
5. Create SUPERSEDES edges from decision `supersedes` references

This happens once on server startup and incrementally on file changes.

**Temporal projection for viz:** When the timeline scrubber needs snapshots at different points in time, the server sorts all decisions by `created_at`, then for each unique timestamp, projects the graph with only decisions up to that cutoff. This is the only place where the full "replay" model is needed, and it only runs when viz requests it.

### 2.4 Frontend

React SPA served by the HTTP server. Embedded in the build artifact (or served from a static directory during development).

**Core views:**
- **Graph view** — D3 force-directed layout showing nodes, edges, decisions. Click to inspect. Live-updating via WebSocket.
- **Timeline view** — scrubber that shows graph evolution over time. Builds temporal projections on demand.
- **Decision list** — filterable by tags, status, date, affected nodes. Search.
- **Gap view** — highlights nodes with no decisions. Priority-ordered.
- **Detail panel** — full decision content (context, decision, tradeoffs, alternatives) when a decision is selected.

**Live updates:** WebSocket subscription receives graph change events. React state updates. No refresh needed. No stale banner.

**Review UI:** When supersede candidates are detected (overlapping `affects`), the frontend surfaces them for review. Approve supersede or dismiss — both write back to decision files (update status or add a dismissed flag).

### 2.5 MCP Integration

MCP tools query the server's in-memory state via HTTP calls to the local server.

**Read tools:**
- `whygraph_context(file, symbol?)` — what decisions affect this code?
- `whygraph_get_decisions(filters?)` — filtered decision list
- `whygraph_get_gaps(limit?)` — what nodes have no decisions?

**Write tools:**
- `whygraph_create_decision(title, context, decision, tradeoffs, alternatives, affects, tags)` — creates a decision file directly
- `whygraph_create_node(label, name, parent, refs?)` — creates a structural node

**Server auto-start:** If MCP tool is called and server isn't running, start it. Same pattern as beans' Dolt server auto-start.

### 2.6 Worktree Support

**Server watches all worktrees.** When a worktree is created (by Claude Code agent orchestration), the server detects the new `.whygraph/` directory and starts watching it.

**Dirty tracking (beans pattern):**
- Worktree changes are merged into runtime state as "dirty" — visible in the graph and frontend but not persisted to main repo disk
- ETag comparison between worktree and main versions
- When the worktree branch merges to main, the file watcher on main picks up the new files and clears the dirty flags

**Decision-to-worktree association:** Automatically detected via `git diff` between worktree branch and base — any new/modified `.whygraph/decisions/*.md` files are associated with that worktree.

**What the worktree agent sees:** A full copy of `.whygraph/` (all files are git-tracked). The agent can write decision files, commit them, and they'll merge cleanly because they're new files that don't exist on main yet.

### 2.7 CLI

- `whygraph init` — create `.whygraph/` directory, config, initial App node
- `whygraph serve` — start the server (foreground)
- `whygraph viz` — open browser to the React frontend (auto-starts server if needed)
- `whygraph config` — view/update configuration
- `whygraph status` — server health, node count, decision count, gap count, active worktrees
- `whygraph prime` — print agent instructions to stdout
- `whygraph validate` — check all decision/node files for schema errors without modifying anything

No `sync` command. Decisions are immediately available when written.

### 2.8 Agent Instructions

The `INSTRUCTIONS.md` (or equivalent) tells agents:
- How to write decision files (the format, what goes in each field)
- When to write them (after making architectural choices in code)
- Where to write them (`.whygraph/decisions/`)
- How to reference nodes (by ID from `.whygraph/nodes/`)
- That decisions must be complete (no placeholders — use `status: draft` for incomplete thoughts)

The server can also provide this context dynamically via the MCP tools — an agent can ask "what's the decision format?" and get a schema response.

## 3. What Changes From the POC

| Concept | POC | New |
|---------|-----|-----|
| Source of truth | `events.jsonl` (JSONL) | Individual `.md` files (git-tracked) |
| Pipeline | staging → parse → resolve → validate → append → delete | Write file → server detects → graph updates |
| Viz | Static HTML bake, stale banner | Live React frontend, WebSocket updates |
| MCP | Read-only, rebuilds graph per call | Read + write, queries in-memory server |
| Worktree safety | Broken (gitignored state lost) | Safe (all state git-tracked) |
| Reviews | `reviews.jsonl` (mutable, gitignored) | Computed by server from overlapping `affects`, surfaced in UI |
| Errors | `errors.jsonl` (gitignored) | Computed on parse, surfaced in UI and API |
| Sessions | `sessions.json` (gitignored) | Server tracks active connections |
| UUID map | `uuid-map.json` (gitignored) | IDs are in front matter, no external map needed |
| Sync | Explicit `whygraph sync` command | Automatic on file write (file watcher) |
| Server | None (stateless CLI + MCP) | Long-running HTTP server with file watchers |

## 4. What Survives (Conceptually)

- **Query semantics** — getContext, getDecisions, getGaps. Same questions, different data source.
- **Decision data model** — context, decision, tradeoffs, alternatives, affects, tags, supersedes. Richer than beans but same structure.
- **Graph type system** — App → Feature → Component hierarchy with Decision cross-cuts via AFFECTS.
- **Edge semantics** — COMPOSES, AFFECTS, SUPERSEDES, DEPRECATES.
- **Cascade removal** — deleting a parent removes children and orphans affected decisions.
- **Supersede detection** — overlapping `affects` flags potential supersessions.
- **Validation before write** — enforce complete decisions, valid references, schema conformance.
- **Error collection** — report all problems, don't stop at first error.

## 5. New Capabilities Enabled by the Server

With a running server, things that were impossible or awkward become natural:

- **Live graph visualization** — see decisions appear in real time as agents work
- **Cross-worktree visibility** — main developer sees what all worktree agents are doing, in one graph
- **Decision creation via MCP** — agents create decisions through the API, not by writing markdown manually
- **Validation on write** — server validates decision files as they're written, immediate feedback
- **Search** — full-text search across all decisions (in-memory index, like beans' Bleve)
- **Decision analytics** — which areas have the most decisions? Which have the most churn? Which are most referenced?
- **Review workflow in UI** — supersede candidates surfaced with approve/dismiss buttons, not hidden in a JSONL file
- **Agent session awareness** — server knows which agents are active, what they're working on, what decisions they've created

## 6. Open Questions for Grill Session

1. **GraphQL vs REST+WebSocket** — GraphQL adds a dependency but simplifies the API surface. Beans chose GraphQL. Do we follow?

2. **Agent spawning** — Beans spawns Claude Code as a subprocess with stream-json protocol, enabling session resume and tool call interception. Should whygraph manage agents, or leave that to the developer/orchestrator? This is scope creep toward beans' territory but enables tight integration.

3. **Node file management** — Who creates structural node files? `whygraph init` creates the App node. Do agents create Feature/Component nodes when they encounter new code areas? Or does the developer define the structure upfront?

4. **Decision file authoring** — Should agents write markdown files directly, or always go through the MCP `create_decision` tool? The tool ensures validation; direct file writing is more flexible but can produce invalid files.

5. **Frontend embedding** — Beans embeds the Svelte SPA in the Go binary via `go:embed`. For Node.js + React, we'd either bundle the frontend into the server package or serve from a directory. How does this ship?

6. **Scope boundary with beans** — Beans is a task/project management tool. Whygraph is a decision graph. But with a server, React UI, and worktree management, the surface areas overlap. Where do we draw the line? Does whygraph replace beans or complement it?

7. **Performance at scale** — 10,000 decision files parsed on startup. Acceptable? When does the cache become necessary?

8. **Offline/CI usage** — If the server isn't running, can CLI commands still work (stateless parse-from-disk)? Or is the server always required?

9. **Multi-project** — One server per project, or one server managing multiple `.whygraph/` directories?

10. **Decision lifecycle** — Draft → Active → Superseded is clear. But what about decisions that are wrong or no longer relevant but not superseded by anything? Do we need a "retired" or "archived" status?
