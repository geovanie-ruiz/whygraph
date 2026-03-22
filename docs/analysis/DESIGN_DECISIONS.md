# Whygraph — Design Decisions

This document captures the full design as resolved through an interview process, using the original spec (`docs/spec/WHYGRAPH_SPEC.md`) as a starting point. Where this document differs from the spec, this document takes precedence.

---

## Purpose

Whygraph is a repo-native architectural decision graph for agentic codebases. It solves cognitive debt within teams that heavily rely on AI development by answering **why** an application is built the way it is.

The framework covers five dimensions:

| Dimension | Representation in Whygraph |
|-----------|---------------------------|
| **Why** | Decisions (rationale, tradeoffs, alternatives) |
| **What** | Nodes (features, components) |
| **Where** | Code references (symbols, file paths) |
| **When** | Timeline (event timestamps, scrubber) |
| **How** | The codebase itself (whygraph points to it via refs) |

"Who" was evaluated and excluded — if rationale is well-captured, the author doesn't help resolve cognitive debt.

---

## Primary Deliverable

The visualization is the primary deliverable. If only one thing works, it must be the viz. The event log and graph are the engine that powers it. The CLI and MCP server are input/query mechanisms.

---

## Architecture: Event Sourcing + Graph Projection

### Event Log

`.whygraph/events.jsonl` — append-only, immutable source of truth. Lines are never modified or deleted. The only way to change graph state is to append new events.

Five event types: `node_added`, `edge_added`, `node_patched`, `edge_removed`, `node_removed`.

### Projection

`projection.ts` replays the event log into a `graphology.MultiDirectedGraph`. The graph is transient — rebuilt from scratch on every read. No caching, no invalidation logic. At expected scale (tens to hundreds of events), rebuild is sub-millisecond.

Temporal snapshots: `buildGraphAt(events, cutoff)` replays events up to a timestamp.

### Error Handling

- **Application-level changes** (built it one way, changed it later) → supersede. Both decisions are real history and persist in the log.
- **Whygraph-level errors** (typo, malformed staging entry) → fix before it reaches `events.jsonl`. These are bugs in the capture pipeline, not decisions. `process-staging` is the validation boundary. Once something is in `events.jsonl`, it's correct by definition.

---

## Graph Schema

### Node Types

| Label | Properties | Status Values | Description |
|-------|-----------|---------------|-------------|
| `App` | `name`, `description?`, `refs?` | — | Top-level node, one per project |
| `Feature` | `name`, `description?`, `refs?` | `active`, `deprecated` | Major pieces of the app (auth, core, etc.) |
| `Component` | `name`, `description?`, `refs?` | `active`, `deprecated` | What makes up features, recursively composable |
| `Decision` | `title`, `date`, `context`, `decision`, `tradeoffs`, `alternatives`, `status`, `affects`, `tags`, `supersedes?` | `active`, `superseded` | Rationale for why a node is built the way it is |

Status is tracked at the appropriate layer:
- **Decisions**: `active` or `superseded` (replaced by another decision via SUPERSEDES edge)
- **Features/Components**: `active` or `deprecated` (phased out in favor of another via DEPRECATES edge)

### Edge Types

| Label | Valid From → To | Description |
|-------|----------------|-------------|
| `COMPOSES` | App → Feature, App → Component, Feature → Component, Component → Component | Structural hierarchy |
| `AFFECTS` | Decision → Feature, Decision → Component | Decision applies to this node |
| `SUPERSEDES` | Decision → Decision | New decision replaces old |
| `DEPRECATES` | Component → Component, Feature → Feature | New node deprecates old node (direction: new → old, consistent with SUPERSEDES) |

### Structural Hierarchy

Components and features compose recursively. Components can also attach directly to the App node (shared utilities, config modules, etc.):

```text
App
├── Feature
│   └── Component
│       └── Component
│           └── Component (as deep as needed)
└── Component (shared utilities, not part of a feature)
```

### Code References (Symbol-Based)

Nodes have an optional `refs` field — an array of symbol references grounding the abstract graph in concrete code.

```typescript
interface SymbolRef {
  file: string;    // relative path to repo root
  symbol?: string; // function/class/interface name — omit for directory/file-level refs
}
```

- Features can have folder-level refs (`{ file: "src/auth/" }`)
- Components have symbol-level refs (`{ file: "src/auth/oauth.ts", symbol: "OAuthProvider" }`)
- Refs are updated via `node_patched` events — no new event type needed
- Symbol names are the stable identifier; line numbers are not stored (too fragile)
- When the agent modifies code belonging to a component (e.g., function rename), it stages a ref update

### Decision Properties

```typescript
interface DecisionProperties {
  title: string;
  date: string;              // Presentational — e.g. "2026-03-21", "September 2025", "Date unknown"
  context: string;           // Why this decision was needed
  decision: string;          // What was chosen and how
  tradeoffs: string;         // What was gained vs. given up
  alternatives: string;      // Other approaches considered and why rejected
  status: DecisionStatus;    // "active" | "superseded"
  affects: string[];         // Node UUIDs this decision touches
  tags: DecisionTag[];       // From fixed taxonomy
  supersedes?: string;       // Decision UUID this replaces
}
```

### Status Lifecycle

Decisions and structural nodes have separate status models:

**Decisions**: `active` | `superseded`
- A decision is `active` until another decision supersedes it via a SUPERSEDES edge
- The old decision's status is patched to `superseded`

**Features/Components**: `active` | `deprecated`
- A feature or component is `active` until another feature/component deprecates it via a DEPRECATES edge
- Agents detect deprecation signals (changelogs, compiler warnings, API deprecation notices) and stage the deprecation relationship

### Tags (Fixed Taxonomy)

| Tag | Covers |
|-----|--------|
| `arch` | Structural decisions, module boundaries, patterns |
| `data` | Storage, schemas, databases, caching |
| `security` | Auth, encryption, access control, secrets |
| `performance` | Optimization, scaling, resource usage |
| `integration` | APIs, third-party services, protocols |
| `infra` | Deployment, CI/CD, configuration, environments |
| `ux` | User-facing behavior, UI decisions |

Decisions can have multiple tags. The agent assigns tags from this fixed set. Miscategorization is an accepted cost of efficiency — consistency matters more than perfect accuracy.

### IDs

All node and edge IDs are **UUIDs** assigned by `process-staging`. The agent never generates IDs. Staging entries use local aliases for cross-references within a batch. Human-readable names are the display label in the viz and MCP responses.

### ID Validation

Node IDs: UUIDs (assigned by process-staging)
Edge IDs: UUIDs with `edge-` prefix (assigned by process-staging)
All other string validation: `/^[a-zA-Z0-9-]+$/` (allows uppercase, used for aliases and legacy compatibility)

---

## Data Flow

### Capture (During Agent Work)

The agent writes structured entries to its session-specific staging file (`.whygraph/staging/session-<id>.md`) as it works. This is the only write path. Cost: ~150-200 tokens per entry. Each agent session has its own file, eliminating write contention in multi-agent environments. Multiple entries per file.

The staging format is structured enough to be mechanically parsed by deterministic code — no LLM needed for processing. The agent writes richer notes at capture time (when reasoning is fresh) to avoid needing an LLM to expand terse notes later.

### Multi-Agent Session Coordination

`.whygraph/sessions.json` tracks active agent sessions:

```json
{
  "active": [
    { "id": "session-abc123", "startedAt": "2026-03-21T14:00:00Z", "platform": "claude-code" },
    { "id": "session-def456", "startedAt": "2026-03-21T14:05:00Z", "platform": "cursor" }
  ]
}
```

Lifecycle:
1. **Agent starts working** → skill registers the session in `sessions.json`
2. **Agent writes staging entries** → to its session file `.whygraph/staging/session-<id>.md`
3. **Agent finishes turn** → hook fires → deregisters from `sessions.json` → triggers sync check
4. **Sync checks `sessions.json`** → if other sessions are still active, sync skips silently. Staging files accumulate.
5. **Last agent deregisters** → `sessions.json` is empty → sync processes all staging files at once

This ensures the graph only updates when all agents are done and the full picture is available.

**Crash recovery**: if an agent crashes without deregistering, its session stays in `sessions.json`. No TTL — the user clears stale sessions explicitly:

- `whygraph sync` — shows stale sessions, prompts user to flush
- `whygraph sync --flush` — clears all sessions and processes (for scripted/MCP use)
- MCP returns actionable error: "Sync blocked by stale sessions. Run `whygraph sync --flush` to clear."

### Staging File Format

```markdown
## [feature] Notifications
timestamp: 2026-03-21T14:05:00Z
alias: notifications
description: Push and in-app notification system
refs:
  - file: src/notifications/

## [component] OAuth callback handler
timestamp: 2026-03-21T14:06:00Z
alias: oauth-callback
parent: c4e82b1f-9012-4d3e-bcde-234567890abc
description: Handles OAuth provider callbacks and token exchange
refs:
  - file: src/auth/oauth/callback.ts, symbol: handleOAuthCallback

## [ref-update] d5f93c2a-3456-4e7f-cdef-345678901bcd
timestamp: 2026-03-21T14:07:00Z
add:
  - file: src/auth/oauth/pkce.ts, symbol: PKCEFlow
remove:
  - file: src/auth/oauth/legacy.ts, symbol: LegacyFlow

## [deprecate] e6a04d3b-old-uuid f7b15e4c-new-uuid
timestamp: 2026-03-21T14:08:00Z

## [decision] Use JWT over session cookies
timestamp: 2026-03-21T14:10:00Z
context: Session cookies don't work well with mobile clients
  and require server-side state. The mobile app needs stateless
  auth that works across API boundaries.
decision: Use JWT tokens for authentication. Tokens are signed,
  stateless, and include user claims.
tradeoffs: Gained stateless auth, lost easy revocation. Token
  expiry is the primary revocation mechanism.
alternatives: Session cookies (rejected: requires server-side
  session store, doesn't work for mobile). OAuth-only (rejected:
  not all consumers are OAuth clients).
files-touched: src/auth/session.ts, src/auth/oauth/callback.ts
tags: security, arch
supersedes: b7d91a3e-5678-4c9f-abcd-1234567890ef

## [resolve-review] review-line-id
timestamp: 2026-03-21T14:12:00Z
action: supersede

## [node-removed] e6a04d3b-4567-4f8a-def0-456789012cde
timestamp: 2026-03-21T14:15:00Z
```

Entry types and the events they emit:

| Staging Type | Events Emitted |
|-------------|---------------|
| `[decision]` | `node_added` (Decision) + `edge_added` (AFFECTS) per file-resolved node |
| `[component]` | `node_added` (Component) + `edge_added` (COMPOSES to parent) |
| `[feature]` | `node_added` (Feature) + `edge_added` (COMPOSES to app) |
| `[ref-update]` | `node_patched` (full merged refs array) |
| `[patch]` | `node_patched` (arbitrary properties except `affects` and `label`, which are managed by edges and node creation respectively) |
| `[deprecate]` | `edge_added` (DEPRECATES) + `node_patched` (status: deprecated) |
| `[resolve-review]` | supersede: `node_patched` + `edge_added` (SUPERSEDES). dismiss: removes review entry |
| `[node-removed]` | `node_removed` + `edge_removed` for all connected edges + recursive `node_removed` + `edge_removed` for all COMPOSES descendants + `node_patched` to update `affects` on decisions that lose edges + `node_removed` for decisions that lose all AFFECTS edges (auto-generated) |

Processing order is **global across all staging files** (not per-file). All entries from all session files are collected, then processed by type priority:

1. `[feature]` entries (from all files)
2. `[component]` entries (from all files)
3. `[ref-update]` entries (from all files)
4. `[patch]` entries (from all files)
5. `[deprecate]` entries (from all files)
6. `[decision]` entries (from all files)
7. `[resolve-review]` entries (from all files)
8. `[node-removed]` entries (from all files)

This ensures that in multi-agent scenarios, structural nodes from one agent's staging file exist before another agent's decisions try to resolve `files-touched` against them.

Local aliases (e.g., `alias: oauth-callback`) allow cross-references within the same staging file. Aliases are file-scoped — they resolve only within the file they're defined in. `process-staging` resolves aliases to the UUIDs it assigns. Aliases never reach `events.jsonl`. Aliases can also be used in `[deprecate]` entries for the new-node reference.

**`parent: app`** is a reserved keyword for components directly under the App node. `process-staging` resolves it to the App UUID (first event in events.jsonl).

References to existing nodes use real UUIDs (the agent knows these from MCP queries). Staging files are machine-to-machine buffers — not intended for human readability.

**`files-touched`** is the primary way to specify what a decision affects. The agent lists the file paths it modified. `process-staging` resolves file paths to node UUIDs via the refs in the graph (exact file match, then COMPOSES traversal for parent chain). If a file can't be resolved, the entry goes to `errors.jsonl`.

**`affects`** is an alternative for cases where the agent has node UUIDs directly (e.g., from `whygraph_get_gaps` during `/whygraph-interview`). The agent lists UUIDs explicitly. `process-staging` uses them directly without resolution.

A decision entry must have `files-touched` or `affects` (or both — results are merged). If neither is present, it's a validation error.

**`timestamp`** field on every entry. The agent writes the current ISO timestamp at capture time. `process-staging` uses this for emitted events. If missing, falls back to sync time.

**`date`** optional field on decisions. Presentational — a human-readable label for when the decision was made (e.g., `"2026-03-21"`, `"September 2025"`, `"Date unknown"`). If absent, derived from `timestamp` as YYYY-MM-DD. The `timestamp` field is used for timeline ordering; `date` is for display only.

Multiline values are supported. Parsing rule: a line starting with a known key (`timestamp:`, `date:`, `context:`, `decision:`, `tradeoffs:`, `alternatives:`, `files-touched:`, `affects:`, `tags:`, `supersedes:`, `alias:`, `parent:`, `description:`, `refs:`, `add:`, `remove:`, `action:`) or a new `##` heading starts a new field. Everything else is continuation of the current field.

### Processing (Deterministic, No LLM)

`whygraph sync` (or hook-triggered `process-staging`) runs as a deterministic Node script:

1. Check `sessions.json` — if active sessions exist, skip silently (hook-triggered) or prompt user (manual). `--flush` flag clears all sessions and proceeds.
2. Acquire `.whygraph/.lock` (prevents concurrent sync runs)
3. Clear `errors.jsonl` (errors are ephemeral — only meaningful between syncs)
4. Read all session staging files from `.whygraph/staging/`
5. Parse staging entries from each file. Collect all entries globally, then process by type priority (features → components → ref-updates → deprecations → decisions → review resolutions → node removals)
6. Resolve aliases (file-scoped). Resolve `parent: app` to App UUID. Resolve `[deprecate]` aliases.
7. Assign UUIDs to new nodes/edges
8. Validate each entry. Invalid entries → `errors.jsonl` with validation error details (delete their staging files)
9. For `[node-removed]` entries, recursively collect all COMPOSES descendants and their edges for removal. Auto-dismiss any reviews in `reviews.jsonl` referencing decisions being removed. Emit events in order: (a) `node_patched` to update decision `affects` arrays, (b) `edge_removed` for all edges, (c) `node_removed` for nodes (children first, parent last)
10. For valid decision entries, check `events.jsonl` for existing decisions that AFFECT the same nodes (supersede candidate detection)
11. If overlap found → append the decision normally, write the potential conflict to `.whygraph/reviews.jsonl` (with UUID `id`)
12. If no overlap → append the decision normally
13. All events emitted from a single staging entry share that entry's capture timestamp
14. Build all new events in memory. Dedup check: compare timestamp + content hash against recent events in `events.jsonl` to prevent duplicates from crash recovery
15. Serialize as a single string, write in one `fs.appendFile` call (atomic append)
16. If viz HTML exists → inject stale banner into the HTML file
17. Delete processed staging files
18. Release `.whygraph/.lock`

### Review Process

`.whygraph/reviews.jsonl` captures potential supersede relationships detected by `process-staging`. Each line is a JSON object:

```json
{"id":"review-uuid","newDecisionId":"uuid","existingDecisionId":"uuid","sharedNodeIds":["uuid"],"status":"pending"}
```

Review entries have a UUID `id` field assigned by `process-staging` at creation time. `[resolve-review]` references this ID.

Review resolution:
- Agent calls `whygraph_get_reviews()` via MCP to get pending reviews with IDs
- Agent presents to user (or resolves autonomously if configured)
- User confirms supersede → agent writes `[resolve-review] <review-id>` with `action: supersede` to staging
- User dismisses → agent writes `[resolve-review] <review-id>` with `action: dismiss` to staging
- Next sync processes: supersede emits `node_patched` + `edge_added` (SUPERSEDES); dismiss just removes the review entry

### Error Handling

Invalid staging entries are moved to `.whygraph/errors.jsonl`. Each line is a JSON object with the raw entry and validation error. `errors.jsonl` is cleared at the start of each sync — errors are ephemeral, only meaningful between syncs. MCP server checks for non-empty `errors.jsonl` and surfaces warnings. Agent calls `whygraph_get_errors()` to get details.

### Staleness and Review Enforcement

Staleness and review checks are enforced across all interfaces:

| Interface | Staging has files + no sessions | Staging has files + sessions active | Review (reviews.jsonl) |
|-----------|-------------------------------|-------------------------------------|------------------------|
| **MCP** | Reject: "sync needed" | Warn but serve: "data may not reflect pending changes" | Warn: "decisions pending review" |
| **CLI: viz** | Reject: "Run `whygraph sync` first" | Warn but still bake | Warn but still bake |
| **CLI: sync** | Processes it | Prompt to flush or skip | Surface items, offer to resolve via `prompts` |
| **Viz HTML** | Stale banner (injected by sync) | — | Review banner with pending count |

---

## CLI

Four commands:

### `whygraph init`

Guided onboarding flow using `prompts` library. Two phases:

**Phase 1 — CLI (mechanical):**

1. **Environment selection**: Claude Code / Cursor / Copilot / Other → determines hook mechanism and skill/prompt format. Defaults to Claude Code.
2. **Sync trigger preference**: Hook (Claude Code) / Git hook / Manual → determines when staging is processed. Defaults to hook.
3. **Context injection preference**: Always inject decisions before modifying a feature / Ask user permission with token estimate / Never inject. Defaults to always.
4. **Autonomy level**: Full / Supervised / Manual. Defaults to supervised.
5. **Autonomy disclaimer**: "Whygraph tracks architectural decisions to reduce cognitive debt. If the graph falls out of sync with your app, it becomes misleading — worse than having no graph. More autonomy = less friction, more token usage."
6. **Create `.whygraph/` directory**: `events.jsonl`, `staging/` (empty dir), `config.json`, `sessions.json` (`{"active":[]}`), `reviews.jsonl` (empty), `errors.jsonl` (empty), `viz/` (empty dir), `.gitignore` (ignores staging/, sessions.json, errors.jsonl, .lock, .sessions-lock)
7. **Write App `node_added` event** directly to `events.jsonl` (one-time bootstrap write path)
8. **Generate platform-specific files**: Claude Code skill/prompt, .cursorrules, copilot instructions, etc.
9. **Install hooks**: Claude Code hooks in settings.json, or git hooks in `.git/hooks/`, based on preference. If a `post-commit` hook already exists, print instructions to add `npx whygraph sync` manually instead of overwriting.
10. **Bake initial viz**: Generate first HTML (lone App node) and open in browser
11. **Print instructions**: direct the user to run `/whygraph-scan` in their agent to map the codebase

**Phase 2 — Agent skill (`/whygraph-scan`):**

Agent-driven codebase analysis, separate from the CLI. The agent reads the codebase, proposes an exhaustive feature/component tree, user confirms, agent writes to staging, sync processes it. The initial scan should be exhaustive — map everything the agent can identify. The viz handles visual complexity through filtering, not the graph.

After scan, the agent offers `/whygraph-interview` to capture historical decisions.

**Idempotency**: If `whygraph init` is run again and `.whygraph/events.jsonl` already exists, it skips creation, checks for config drift / missing hooks / platform file staleness, repairs as needed, and directs the user to `/whygraph-scan` if no features exist in the graph.

### `whygraph sync`

Deterministic processing of staging file. Called by hooks or manually.

### `whygraph viz`

Bake HTML from `events.jsonl`. Remove stale banner. Open in browser.

### `whygraph config`

Flag-driven preference modification. Regenerates platform-specific files from `.whygraph/config.json`.

```bash
whygraph config --context-injection always
whygraph config --autonomy full
whygraph config --sync-trigger git-hook
```

---

## MCP Server

Read-only, 5 tools. Stdio server via `@modelcontextprotocol/sdk`.

Reload on every call: `loadEvents()` → `buildGraph()` at the start of every tool handler. Never cache. If `.whygraph/` or `events.jsonl` doesn't exist, all tools return error: "Whygraph not initialized. Run `whygraph init` first." The server starts and stays alive regardless — it doesn't crash the platform config.

### Staleness Logic

- **Staging has files AND sessions.json is empty** → reject: "Sync needed. Run `whygraph sync`."
- **Staging has files AND sessions are active** → serve from last-synced `events.jsonl` with warning: "Active agent sessions — data may not reflect pending changes."
- **Staging empty** → serve normally.
- **`reviews.jsonl` non-empty** → include warning: "N decisions pending review."
- **`errors.jsonl` non-empty** → include warning: "N staging entries failed validation."

### Tools

**`whygraph_context(file: string, symbol?: string)`**
Primary tool. Resolves the file/symbol to node(s) in the graph via exact file path match against node refs. Traverses COMPOSES upward to include the parent chain. Returns the matched nodes (UUIDs, names, types, parent chain) and all decisions affecting those nodes (full properties). One call gives the agent everything it needs to understand constraints before modifying code, and the node UUIDs needed for staging entries. If no match found, returns error suggesting `/whygraph-scan` to map unmapped files.

**`whygraph_get_decisions(filters: { status?, tags?, after?, before? })`**
Broad query tool. Returns decision node attributes matching filters. Tags use OR logic — `tags: ["security", "data"]` returns decisions with security OR data. All filters use AND logic between different filter types. `after` and `before` filter on the event timestamp (not the presentational `date` field).

**`whygraph_get_gaps(limit?: number)`**
Returns up to `limit` (default 10) nodes that have no AFFECTS edges (no decisions pointing at them). Ordered hierarchically: features first, then top-level components, then deeper components. Used by the interview skill to find areas needing historical decision capture.

**`whygraph_get_reviews()`**
Returns all pending review entries from `reviews.jsonl`. Platform-agnostic — agent doesn't need filesystem access.

**`whygraph_get_errors()`**
Returns all failed staging entries from `errors.jsonl` with validation error details. Platform-agnostic.

---

## Visualization

### Generation

`whygraph viz` generates a single self-contained HTML file. D3.js v7 is **embedded inline** (~280KB) — no CDN dependency. The file works offline, opens via `file://`, and is committable to the repo.

### Data Embedding (Pre-Baked Snapshots)

At bake time, the CLI replays the event log and at each unique timestamp, snapshots the full graph state. The HTML embeds:

```html
<script>
  const SNAPSHOTS = [
    { timestamp: "2025-03-20T00:00:00Z", graph: { nodes: [...], edges: [...] } },
    { timestamp: "2025-03-20T00:01:00Z", graph: { nodes: [...], edges: [...] } },
    ...
  ];
  const BAKED_AT = "2025-03-21T14:32:00Z";
  const REVIEW_COUNT = 2;
</script>
```

No projection logic in the HTML. The viz is a pure renderer — no logic, just "here's the graph at snapshot index N, draw it." One snapshot per unique timestamp. During init, all nodes created in one burst = one snapshot = "here's the app as it existed when you ran whygraph init."

### Layout

Force-directed graph using `d3.forceSimulation`. First-level nodes (features) spaced well enough to be clearly visible. Deeper nodes cluster around their parents.

### Node Visual Treatment

Shape encodes node type (accessible — does not rely on color alone). Color is supplementary.

| Label | Shape | Size | Fill | State Indicator |
|-------|-------|------|------|-----------------|
| `App` | Large circle | 24 | `#1e293b` | — |
| `Feature` | Rounded rectangle | 18 | `#2563eb` | — |
| `Feature` (deprecated) | Rounded rectangle | 18 | `#2563eb` at 50% | Hatched/striped pattern fill |
| `Component` | Circle | 12 | `#93c5fd` | — |
| `Component` (deprecated) | Circle | 12 | `#93c5fd` at 50% | Hatched/striped pattern fill |
| `Decision` (active) | Diamond | 14 | `#f59e0b` | Solid fill |
| `Decision` (superseded) | Diamond | 14 | `#d1d5db` | Dashed stroke, no fill |

Diamond shape: `<rect>` rotated 45 degrees. Node labels: structural nodes show `name`, decision nodes show truncated title (tooltip shows full title, panel shows everything).

**Deleted nodes** (at the `node_removed` timestamp): rendered in red (`#ef4444`) with aggressive cross-hatch pattern. In subsequent snapshots: gone entirely.

Viz includes a **legend** showing shape/color/pattern mapping.

### Edge Visual Treatment

| Label | Stroke | Style | Simulation Force |
|-------|--------|-------|-----------------|
| `COMPOSES` | `#475569` | Solid, width 1.5 | Short distance (80), strong — defines hierarchy |
| `AFFECTS` | `#f59e0b` | Dashed `[4,3]`, width 1 | Medium distance (140), weaker — decisions float near targets |
| `SUPERSEDES` | `#94a3b8` | Dotted `[2,3]`, width 1, arrow to superseded node | No force — informational overlay only |
| `DEPRECATES` | `#ef4444` | Dotted `[2,3]`, width 1, arrow to deprecated node | No force — informational overlay only |

### Interaction: Focus + Context

1. **Default view**: Full graph visible, features clearly spaced, deeper nodes clustered
2. **Click a feature**: its subtree spreads out, everything else fades (~10-20% opacity), view recenters on the selected feature
3. **Click a component within**: that component's children spread, siblings compress, view recenters — progressive disclosure one level at a time
4. **Jump to a node** (via URL or tag filter): same behavior — that node becomes focus, immediate children spread, ancestors visible as breadcrumbs, everything else fades
5. **Cross-cutting decisions**: when focused on a feature, a decision that also affects another feature shows a dimmed edge to the out-of-focus feature — signaling broader impact
6. **Click any other node while focused**: shift focus directly to that node — one click to jump anywhere, faded nodes are clickable
7. **Click background**: unfocus, return to full graph view
8. **Focus auto-clears** when the focused node becomes invisible (due to tag filtering or timeline scrubbing past its creation)

### Timeline Scrubber

Fixed at bottom of viewport. Maps scrubber position → snapshot index.

- Focus state persists across scrubbing — the scrubber changes what's in the graph, focus changes what's emphasized
- If a focused node doesn't exist at the current scrubber position, everything shows at full opacity until it appears
- Nodes not in the current snapshot simply don't render — the graph grows as the scrubber moves forward, shrinks as it moves back
- Deleted nodes: at the removal timestamp, rendered in red with aggressive cross-hatch pattern; in subsequent snapshots, gone entirely
- Label shows the current snapshot date
- Focus+context is the only transparency system — no competing opacity from timeline

### Side Panel

Right-aligned, 320px, slides in on node click.

**Feature or Component node:**
- Name (heading) + status chip (active/deprecated)
- Description
- If deprecated: "Deprecated by: [name]" — clickable, shifts focus
- If this node deprecates another: "Deprecates: [name]" — clickable
- Code refs (file paths + symbols, linkable)
- Decisions that AFFECT this node (current snapshot edges only), ordered by date
- Each decision: title + status chip + date + tags
- Click a decision to open its detail

**Decision node:**
- Title (heading) + status chip + tags
- Date
- Collapsible sections (closed by default): Context, Decision, Trade-offs, Alternatives
- Affects list: node names as clickable chips
- Supersedes / Superseded-by links
- Always visible: title, status, date, tags, affects

Close button top-right. Click background also closes.

### Tag Filtering

Filter bar at top of viz with 7 tag chips, all on by default. Click a chip to toggle it off. Tag filtering simplifies the entire graph — not just hiding decisions, but showing a "slice" of the architecture by concern:

- Decisions matching active tags are shown
- Structural nodes those decisions AFFECT are shown
- COMPOSES chain up to App is shown (hierarchy context)
- Everything else disappears

Multiple active tags use OR logic. All tags on = full graph.

When tag filtering (combined with any timeline position) results in zero visible decisions, the viz shows a message overlay: "No decisions match the current filters." Structural nodes are hidden but the message makes clear this is a filter state, not an empty graph.

### Search

No search. Navigation is:
- **Spatial**: click through the hierarchy
- **Tags**: filter by concern (see above)
- **Agent**: for inferential questions ("did we consider a caching layer?"), ask the agent — it has MCP access

### URL-as-State

The viz encodes view state in the URL hash so F5 preserves the current view:

```
index.html#focus=<node-uuid>&t=<snapshot-index>&tags=security,data
```

On load, the viz reads the hash and restores focus, scrubber position, and tag filter state.

### Banners

- **Stale banner**: injected into the HTML file by `process-staging` when new events are appended after the last bake. Says "Run `whygraph viz` to update this visualization." Removed when `whygraph viz` rebakes.
- **Review banner**: baked into the HTML if `reviews.jsonl` is non-empty at bake time. Shows count of pending reviews.
- **Bake timestamp**: always visible (footer), so the user knows when the viz was last updated.

### Other Interactions

- Pan and zoom: `d3.zoom()` on the SVG container
- Drag nodes: `d3.drag()`, updates simulation position
- Hover: tooltip with name + type

---

## Platform Integration

### Separation of Concerns

Whygraph (the tool) is platform-agnostic. It reads and writes files. No LLM dependency, no API keys.

Agent intelligence lives in platform-specific skills/prompts that any AI coding tool could implement.

```text
┌─────────────────────────┐
│ Agent Platform           │  Claude Code, Cursor, Copilot, etc.
│  └── Skill/Prompt        │  "analyze codebase, populate whygraph"
├─────────────────────────┤
│ Whygraph (the tool)      │  Node CLI, no LLM dependency
│  ├── init (guided)       │  create .whygraph/, config, hooks
│  ├── sync [--flush]      │  parse staging → append events
│  ├── viz                 │  bake HTML from events
│  ├── config              │  modify preferences (flag-driven)
│  └── mcp                 │  start MCP stdio server
├─────────────────────────┤
│ .whygraph/               │
│  ├── events.jsonl        │  append-only event log
│  ├── staging/            │  per-session files (one per agent session)
│  ├── config.json         │  user preferences
│  ├── sessions.json       │  active agent session tracking
│  ├── reviews.jsonl       │  potential supersede candidates
│  ├── errors.jsonl        │  invalid staging entries
│  ├── .lock               │  sync lock file
│  ├── .sessions-lock      │  session registration lock
│  ├── .gitignore          │  ignores transient files
│  └── viz/index.html      │  baked visualization
└─────────────────────────┘
```

### Hook Mechanisms

| Platform | Mechanism | When processing triggers |
|----------|-----------|------------------------|
| Claude Code | Hooks in settings.json | After agent finishes a turn |
| Cursor | Git hook | On commit |
| Copilot | Git hook | On commit |
| Windsurf | Git hook | On commit |
| Manual | User runs `whygraph sync` | When user chooses |

`whygraph init` asks the user's preference and configures accordingly. Claude Code additionally has its own hook for faster updates; git hook is the universal baseline.

No file watcher option — file watchers have a race condition where they can read staging files while the agent is mid-write. Hooks and git hooks fire at known boundaries where the agent is definitively not writing.

### Agent Instructions

The skill/prompt (platform-specific) instructs the agent:

- **Capture decisions**: "When you make a choice between two or more approaches, write a staging entry. Better to have too much information than too little."
- **Map new code**: "When you create a new file or module, stage a `[component]` entry under its parent feature. If you're building an entirely new functional area (new top-level directory, new user-facing capability), stage a `[feature]` entry instead. When in doubt, create a component — features are rare."
- **Remove deleted code**: "When you delete an entire module or feature, stage a `[node-removed]` entry."
- **Detect deprecations**: "When you encounter deprecation notices — in changelogs, compiler warnings, API responses, or dependency updates — stage a deprecation relationship between the affected structural nodes."
- **Update refs**: "When you modify code belonging to a component (rename, move), update its refs in staging."
- **Query before modifying**: (if context injection is enabled) "Before modifying any file, call `whygraph_context(file)` to understand existing constraints."
- **Respect staleness**: "If any whygraph MCP tool returns a staleness error, stop and inform the user."

### Decision Interview

`/whygraph-interview` — a skill for capturing historical decisions from the developer's mental model.

Flow:
1. Agent calls `whygraph_get_gaps(10)` via MCP
2. Gets nodes with no decisions
3. Walks through them with the user: "Tell me about comp-oauth — why was it built this way?"
4. User answers, agent writes structured entries to staging
5. User stops when they want ("that's all for now")
6. Next session: agent calls `whygraph_get_gaps(10)` again — previously covered nodes now have decisions, new gaps surface

No interview state file. The graph is the state.

### Autonomy Configuration (Set During Init)

| Level | Behavior | Token cost |
|-------|----------|------------|
| **Full autonomy** | Agent processes staging, resolves reviews, manages supersede relationships without user input | Higher |
| **Supervised** | Agent surfaces staging/review state, user confirms actions | Medium |
| **Manual** | User runs `whygraph sync` and resolves reviews themselves | Lowest |

---

## Supersede Workflow

### With Agent

Agent queries the graph before work, recognizes when its new choice replaces an old one, writes `supersedes: <uuid>` in the staging entry. `process-staging` validates the referenced UUID exists and is a Decision node. No validation on the target's status — superseding an already-superseded decision is allowed (whygraph represents what happened, not what should have happened). If it looks confusing in the viz, the developer addresses it.

### Without Agent

`process-staging` automatically detects potential supersede candidates by checking if a new decision and an existing decision both AFFECT the same node. Writes the potential conflict to `.whygraph/reviews.jsonl`. The decision enters the graph without the SUPERSEDES edge. The user or agent resolves the review later, at which point the relationship is patched in.

### Review Resolution

User confirms "yes, X supersedes Y" → agent writes a `[resolve-review]` staging entry with `action: supersede` referencing the review's UUID → next sync emits `node_patched` (status: superseded on old) + `edge_added` (SUPERSEDES, new → old) and removes the review entry.

User says "no, these are independent" → agent writes `[resolve-review]` with `action: dismiss` → sync removes the review entry without creating any edges.

---

## Tech Stack

- **Language**: TypeScript, strict mode
- **Runtime**: Node.js 20+, ESM (`"type": "module"`)
- **Graph**: `graphology` + `graphology-traversal`
- **CLI**: `commander`
- **Prompts**: `prompts` (lightweight, for init guided flow and sync review resolution)
- **MCP**: `@modelcontextprotocol/sdk`
- **Visualization**: D3.js v7 (npm dependency, read from node_modules at bake time, embedded inline in self-contained HTML)
- **Tests**: `vitest`, >90% coverage on core
- **File locking**: `proper-lockfile` (advisory locks, auto-release on crash)
- **Browser opener**: `open` npm package (cross-platform)
- **Build**: `tsc` only, no bundler
- **Distribution**: npm package, installed as local dev dependency (`npm install --save-dev whygraph`)

No external database dependencies.

### MCP Gotcha

`console.log()` in the MCP server corrupts the stdio JSON-RPC stream. All debug output must use `console.error()` or write to a log file.

---

## What Changed from the Original Spec

| Area | Spec | This Design |
|------|------|-------------|
| Primary deliverable | Implied equal weight | Viz is the star, everything else supports it |
| CLI commands | 8 commands with interactive prompts | 4 commands (init, sync, viz, config) + `mcp` subcommand |
| Init | Single CLI command | Two-phase: guided CLI (mechanical) + agent skill (`/whygraph-scan`) |
| Decision capture | Manual CLI (`whygraph add`) or MCP write tools | Staging file per session, `files-touched` (primary) and `affects` UUIDs (for interviews) |
| Affects resolution | Agent specifies node IDs | `process-staging` resolves `files-touched` via refs; `affects` UUIDs used directly |
| MCP server | 6 tools (read + write) | 5 tools (read-only): context, get_decisions, get_gaps, get_reviews, get_errors |
| MCP primary tool | get_feature (by ID) | whygraph_context (by file path) — agent queries by code, not by graph topology |
| MCP staleness | Not addressed | Rejects if staging has files and no active sessions; warns if sessions active |
| Viz data | Events + JS projection logic embedded | Pre-baked snapshots, no projection logic in HTML |
| D3 loading | CDN | Embedded inline for offline support |
| Timeline scrubber | Rebuilds graph via JS `buildGraphAt` | Indexes into pre-baked snapshots |
| Timeline rendering | Nodes at 10% opacity when not in snapshot | Nodes simply don't render — graph grows/shrinks |
| IDs | Human-readable (`CORE-001`, `feat-auth`) | UUIDs assigned by process-staging |
| Node properties | name, description | name, description, refs (symbol references), status |
| Node shapes | All circles (different sizes/colors) | Distinct shapes per type (rectangle, circle, diamond) for accessibility |
| Decision properties | No tags, 3 statuses | Fixed taxonomy tags (7 categories), 2 statuses (active, superseded) |
| Structural status | Not addressed | Features/components have active/deprecated status via DEPRECATES edge |
| Edge types | 3 (COMPOSES, AFFECTS, SUPERSEDES) | 4 (added DEPRECATES) |
| COMPOSES hierarchy | App → Feature only | App → Feature or App → Component (shared utilities) |
| Event types | 4 | 5 (added `node_removed`) |
| ASCII terminal views | graph, decisions, timeline commands | Dropped — viz replaces them |
| Search | Not defined | Not included — spatial + tag filtering + agent queries |
| Tag filtering | Not defined | Full-graph slice by tag concern in viz |
| Platform coupling | Implied Claude Code only | Platform-agnostic tool + platform-specific skills |
| Hook mechanism | Not defined | Claude Code hooks + git hooks as universal baseline |
| Viz staleness | Not addressed | Stale banner injected by process-staging, removed by viz bake |
| Review process | Not addressed | `reviews.jsonl` for supersede candidate resolution |
| Error handling | Not addressed | `errors.jsonl` for invalid staging entries |
| Multi-agent | Not addressed | Per-session staging files, session coordination via `sessions.json`, crash recovery via `--flush` |
| Staging entry types | Not applicable (no staging) | 7 types: decision, component, feature, ref-update, deprecate, resolve-review, node-removed |
| Event timestamps | Not addressed | Capture time (agent writes timestamp), fallback to sync time |
| Concurrent safety | Not addressed | Lock file (`.whygraph/.lock`) + atomic append |
| Schema evolution | Not addressed | Forward-compatible parsing, missing fields default |
| Interview | Not addressed | `/whygraph-interview` skill using `get_gaps` MCP tool |
| Autonomy levels | Not addressed | Full / Supervised / Manual, configured during init |
| Code references | Not in spec | Symbol-based refs on nodes |
| Distribution | Not specified | npm package, local dev dependency |
| Self-dogfooding | Manual seed events during build | Retroactive via `/whygraph-interview` after build |
