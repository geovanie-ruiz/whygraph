# Whygraph Spec Analysis

## What Is Whygraph?

A repo-native architectural decision graph. It answers "why is the code shaped this way?" in a format both humans and AI agents can query. Three deliverables in one package:

1. **Event log** (`.whygraph/events.jsonl`) — append-only source of truth
2. **Graphology graph** — runtime projection built by replaying the log
3. **CLI + MCP server** — interfaces for humans and AI agents

---

## Architecture: Event Sourcing + Graph Projection

The core pattern is event sourcing with a graph projection:

- **Events are facts**: `node_added`, `edge_added`, `node_patched`, `edge_removed` — append-only, never mutated
- **Graph is derived**: replay events into a `graphology.MultiDirectedGraph` on every read
- **Temporal snapshots**: `buildGraphAt(events, cutoff)` replays a subset — no special snapshot logic

### Why This Works Well

- **Simplicity**: JSONL is append-only, human-readable, grep-able, corruption-resilient (only last line at risk)
- **Temporal replay is free**: just replay fewer events — the timeline scrubber falls out naturally
- **No cache invalidation**: rebuild from scratch every time, correctness guaranteed
- **Performance is fine**: at expected scale (tens to hundreds of events per project), full replay is sub-millisecond

### Risks and Tradeoffs

- **Concurrent writes**: CLI and MCP server are separate processes appending to the same file. No file locking in the spec. Interleaved writes could corrupt a line. Mitigated by: events are short single-line JSON, so the corruption window is tiny — but it exists.
- **No partial write recovery**: spec doesn't mention handling a truncated last line from a crash mid-write. Worth addressing in implementation.
- **Schema evolution**: no event versioning scheme. If event shapes change in future versions, old logs need migration or forward-compatible parsing.

---

## Graph Schema

Four node types: `App`, `Feature`, `Component`, `Decision`
Three edge types: `COMPOSES`, `AFFECTS`, `SUPERSEDES`

This is a strict hierarchy (App → Feature → Component) with decisions cross-cutting via AFFECTS edges. The SUPERSEDES chain gives decision lineage.

### Decision Properties

Decisions carry rich structured data: `title`, `date`, `context`, `decision`, `tradeoffs`, `alternatives`, `status`, `affects`. This is essentially an ADR (Architectural Decision Record) embedded in a graph.

### ID Rules

- Nodes: lowercase alphanumeric + hyphens (`feat-auth`, `comp-session`)
- Decisions: area-prefixed (`AUTH-001`, `CORE-002`) — note: uppercase, which conflicts with the node ID regex `/^[a-z0-9-]+$/`
- Edges: `edge-` prefix

**Potential spec inconsistency**: Decision IDs use uppercase (`CORE-001`) but node ID validation requires lowercase. Need to clarify — likely the regex should allow uppercase for decision IDs, or decision IDs should be treated as a separate pattern.

---

## Market Position

### The Gap Whygraph Fills

Existing ADR tools (adr-tools, MADR, log4brains) are:

- **Flat files**: no relationships between decisions
- **No queryability**: can't ask "what decisions affect auth?"
- **Not code-bound**: decisions live in `docs/adr/`, disconnected from architecture
- **Not agent-friendly**: designed for humans reading markdown, not machines querying structured data

Whygraph addresses all four:

- Decisions are **graph nodes** with typed edges (AFFECTS, SUPERSEDES)
- The graph is **queryable** via graphology traversal
- Decisions are **bound to features/components** via AFFECTS edges
- The **MCP server** gives AI agents a structured query interface

### Unique Value Proposition

The intersection of "graph-structured decision records" and "AI-agent-queryable architectural knowledge" is essentially vacant. Structurizr comes closest (decisions attached to C4 models) but isn't agent-oriented. The CLAUDE.md convention provides agent context but is unstructured and doesn't track decision history.

Whygraph is positioned as **the architectural memory layer for agentic codebases**.

---

## Technology Choices

### Graphology (confirmed good choice)

- Well-maintained, ~100-200K weekly npm downloads
- `MultiDirectedGraph` is exactly right for this use case (directed edges, parallel edges between same nodes)
- Rich traversal/algorithm ecosystem
- Not a visualization library — clean separation from D3 viz layer
- TypeScript types included

### Commander (CLI)

- Standard choice, no concerns

### @modelcontextprotocol/sdk (MCP)

- Reached 1.x stable
- Stdio transport well-suited for this use case
- **Critical gotcha**: `console.log()` corrupts the protocol stream. Must use `console.error()` for debugging.
- ESM-only — aligns with project's ESM choice

### D3.js via CDN (Visualization)

- Self-contained HTML approach is novel and elegant
- No build step, works from `file://`, committable to repo
- Timeline scrubber requires a JS port of the projection logic — duplication risk, but acceptable for self-containment

---

## Deliverables Breakdown

### Core (`src/core/`)

| Module          | Responsibility                     | Complexity                                    |
| --------------- | ---------------------------------- | --------------------------------------------- |
| `types.ts`      | All TypeScript types               | Low — type definitions only                   |
| `events.ts`     | Filesystem read/write of event log | Medium — file I/O, validation integration     |
| `projection.ts` | Replay events → graphology graph   | Low — pure function, 4 event types            |
| `query.ts`      | Query the graph                    | Medium — graph traversal, filtering           |
| `validate.ts`   | Event validation rules             | Medium — schema validation, cross-event rules |

### CLI (`src/cli/`)

8 commands: `init`, `add`, `graph`, `decisions`, `timeline`, `supersede`, `feature`, `viz`

`viz` is the most complex — generates a self-contained HTML file with embedded D3 visualization, timeline scrubber, side panel, and a JavaScript port of the projection logic.

### MCP Server (`src/mcp/`)

6 tools mapping to query/mutation functions. Reload events on every call (no caching).

### Tests (`tests/`)

> 90% coverage on core. Spec lists specific test cases for each module.

---

## Open Questions for the Developer

### Architecture & Scope

1. **Decision ID casing**: The spec shows `CORE-001` (uppercase) but the validation regex requires lowercase. Which is intended?
2. **Concurrent write safety**: Two processes (CLI + MCP) can append simultaneously. Is file locking needed, or is the risk acceptable at this scale?
3. **Feature command**: Spec mentions `whygraph feature add` and `whygraph component add` but the command file is `feature.ts` — does one file handle both feature and component creation?
4. **Interactive prompts**: `whygraph init` and `whygraph add` have interactive prompting. What library — `inquirer`, `prompts`, or readline?

### Product & Strategy

5. **Who is the primary user?** Solo developers? Teams? AI agents acting autonomously?
6. **Distribution**: npm package? Is this intended to be published and installable globally?
7. **Self-dogfooding requirement**: The spec says the project must track its own decisions. How many decisions minimum before shipping?
8. **What's the adoption path?** How does someone discover they need Whygraph? What's the "aha moment"?

### Visualization

9. **Offline CDN dependency**: D3 from CDN means the viz needs internet on first open. Should D3 be embedded for true offline support?
10. **GitHub Pages**: Spec mentions the HTML can be served on GH Pages. Is this a priority use case or nice-to-have?

### MCP Integration

11. **MCP config location**: Spec shows `.claude/mcp.json` but Claude Code uses `.claude/settings.json` or `~/.claude/settings.json`. Which is correct for the current Claude Code version?
12. **`npx whygraph-mcp`**: This implies the package is published to npm. Is local development via `node dist/mcp/index.js` the initial path?

---

## Implementation Priority (Suggested)

1. **Core modules** (types → events → validate → projection → query) — foundation, fully testable
2. **CLI basics** (init → feature/component → add → graph → decisions) — usable tool
3. **CLI advanced** (timeline → supersede → viz) — temporal features + visualization
4. **MCP server** — agent interface, depends on core being solid
5. **Self-dogfooding** — record real decisions as the build progresses
6. **Polish** — test coverage, error messages, edge cases
