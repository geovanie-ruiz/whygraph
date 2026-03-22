# Whygraph — Open Questions

Ambiguities and unresolved details found during analysis of `DESIGN_DECISIONS.md` and `SPEC_ANALYSIS.md`. These need resolution before or during implementation.

---

## ~~Init Paradox~~ — RESOLVED

Two-phase design:

**Phase 1 — `whygraph init` (CLI):** Guided flow using `prompts` library. Creates `.whygraph/`, collects config preferences, writes `config.json`, writes the App `node_added` event directly to `events.jsonl` (one-time bootstrap write path, only when file doesn't exist), generates platform-specific files, installs hooks, bakes initial viz (lone App node). Idempotent — if already initialized, checks for config drift/missing hooks/platform files and repairs, then directs user to scan if no features exist.

**Phase 2 — `/whygraph-scan` (agent skill):** Agent reads the codebase, proposes exhaustive feature/component tree, user confirms, agent writes to staging, sync processes it.

Handoff: init prints a prompt for the user to paste into their agent (e.g., `/whygraph-scan`). The CLI cannot invoke an agent.

Init writes the App node directly to `events.jsonl` — this is a contained second write path (single event, only at bootstrap, only when file doesn't exist). All subsequent writes go through staging.

---

## ~~Config Command Interaction Model~~ — RESOLVED

- `whygraph init`: guided flow using `prompts` (lightweight dependency, ~20KB)
- `whygraph config`: flag-driven (`whygraph config --context-injection always`), no prompts needed

All defaults assume Claude Code / agent workflow:
- `environment`: `claude-code`
- `syncTrigger`: `hook`
- `contextInjection`: `always`
- `autonomy`: `supervised`

---

## ~~Config Schema~~ — RESOLVED

```json
{
  "appName": "string",
  "environment": "claude-code | cursor | copilot | other",
  "syncTrigger": "hook | git-hook | manual",
  "contextInjection": "always | ask | never",
  "autonomy": "full | supervised | manual"
}
```

No App UUID in config. `process-staging` reads it from `events.jsonl` (always the first `node_added` event). One source of truth.

---

## ~~Staging Format: Multiline Values~~ — RESOLVED

Multiline values supported. Parsing rule: a line starting with a known key (`context:`, `decision:`, `tradeoffs:`, `alternatives:`, `affects:`, `tags:`, `supersedes:`, `alias:`, `parent:`, `description:`, `refs:`, `add:`, `remove:`) or a new `##` heading starts a new field. Everything else is continuation of the current field. Indented continuation is preferred for readability but not required.

---

## ~~Staging Format: References to Existing Nodes~~ — RESOLVED

UUIDs only. Staging is a machine-to-machine buffer, not human-readable. The agent gets UUIDs from MCP queries. Examples in `DESIGN_DECISIONS.md` should be updated to reflect this.

---

## ~~Staging Error Markers~~ — RESOLVED

Failed entries move to `.whygraph/errors.jsonl`. Each line is a JSON object with the raw staging entry and the validation error. Staging is fully cleared on every sync run — no mixing valid and invalid entries. MCP server checks if `errors.jsonl` is non-empty and surfaces it as a warning.

---

## ~~Review.md Format~~ — RESOLVED

Renamed to `.whygraph/reviews.jsonl`. Machine-to-machine JSONL format:

```json
{"newDecisionId":"uuid","existingDecisionId":"uuid","sharedNodeIds":["uuid"],"status":"pending"}
```

When resolved: the agent writes a resolution entry to staging (supersede relationship or explicit dismissal), `process-staging` processes it and removes the corresponding review entry.

Both `errors.jsonl` and `reviews.jsonl` are machine-to-machine buffers, not markdown.

---

## ~~Concurrent Sync Safety~~ — RESOLVED

`process-staging` acquires `.whygraph/.lock` at start, releases at end. Second instance waits or exits with a message. Standard lock file pattern.

---

## ~~Partial Write Recovery~~ — RESOLVED

`process-staging` builds all new events in memory, serializes the full batch to a single string (multiple JSON lines joined by `\n`), and writes in one `fs.appendFile` call. Combined with the lock file, this prevents interleaving. Worst case on crash: partial last line, which the event log reader handles by skipping malformed trailing lines on load. Staging is only cleared after the append succeeds.

---

## ~~Schema Evolution~~ — RESOLVED

Forward-compatible parsing. Missing fields default to sensible values (`tags` → `[]`, `refs` → `[]`, etc.). No version field. Changes to the schema should be additive (new optional fields). If a breaking change is ever needed, introduce versioning at that point. For now, defensive parsing is sufficient.

---

## ~~Distribution and Installation~~ — RESOLVED

Local dev dependency: `npm install --save-dev whygraph`. Bootstrap via `npx whygraph init` before the dependency exists. Version pinned in `package.json`, shared across the team, fast local resolution.

---

## ~~MCP Server Startup~~ — RESOLVED

MCP server is a subcommand: `whygraph mcp`. Single package, single binary entry point. Platform config:

```json
{ "command": "npx", "args": ["whygraph", "mcp"] }
```

Generated by `whygraph init` based on the configured environment.

---

## ~~Decision Node Display in Viz~~ — RESOLVED

Decisions are real nodes in the graph, visually distinct (smaller, different shape/color) but present. AFFECTS edges connect them to structural nodes. SUPERSEDES edges connect them to each other.

Node labels: structural nodes show `name`, decision nodes show truncated title (tooltip shows full title, panel shows everything).

New edge type added: `DEPRECATES` (Component → Component, Feature → Feature). This moves deprecation to the structural layer.

Decision status simplified to `active` | `superseded` (two states only).
Feature/Component status: `active` | `deprecated` (two states only, via DEPRECATES edge).

Updated edge types:

| Label | Valid From → To |
|-------|----------------|
| `COMPOSES` | App → Feature, Feature → Component, Component → Component |
| `AFFECTS` | Decision → Feature, Decision → Component |
| `SUPERSEDES` | Decision → Decision |
| `DEPRECATES` | Component → Component, Feature → Feature |

Updated viz node treatment:

| Label | Shape | Fill |
|-------|-------|------|
| `Decision` (active) | Diamond | `#f59e0b` |
| `Decision` (superseded) | Diamond | `#d1d5db` with dashed stroke |
| Feature/Component (deprecated) | Circle | original color at 50% opacity with dashed stroke |

---

## ~~Force-Directed Layout vs. Hierarchical Structure~~ — RESOLVED

D3 force simulation uses tiered edge forces:

- **COMPOSES**: short distance (80), strong force — defines visual hierarchy, children cluster around parents
- **AFFECTS**: medium distance (140), weaker force — decisions float near targets without distorting structure
- **SUPERSEDES/DEPRECATES**: no distance force — rendered as visible edges but don't influence simulation positioning. Informational overlays, not structural constraints.

Only two tiers of simulation force (structural + relational). Everything else is drawn lines.

---

## ~~Timeline: Full Graph at 10% Opacity~~ — RESOLVED

Nodes not in the current snapshot simply don't render. The graph grows as the scrubber moves forward, shrinks as it moves back. The user watches the architecture being built over time.

Focus+context is the only transparency system — focused subtree at full opacity, everything else faded. No competing transparency from timeline.

Each snapshot is self-contained. No need to reference the final snapshot.

---

## ~~Tag Filtering UX in Viz~~ — RESOLVED

Filter bar at top of viz with 7 tag chips, all on by default. Click a chip to toggle it off. Tag filtering simplifies the entire graph:

- Decisions matching active tags are shown
- Structural nodes those decisions AFFECT are shown
- COMPOSES chain up to App is shown (hierarchy context)
- Everything else disappears

Multiple active tags use OR logic. All tags on = full graph. This produces a "slice" of the architecture by concern (e.g., security slice, data slice).

---

## ~~Self-Dogfooding~~ — RESOLVED

Build whygraph first, then retroactively populate its own decisions using `/whygraph-interview`. This is the exact workflow for existing codebases — validates the interview flow and the "catch up" use case. No manual seed events needed.

---

## ~~Can COMPOSES Edge Be From App → Component?~~ — RESOLVED

Yes. App → Component is allowed. Shared utilities, config modules, etc. don't need a forced feature wrapper. Inconsistent depth is acceptable.

COMPOSES updated valid pairs: App → Feature, App → Component, Feature → Component, Component → Component.

Features and components are visually distinct by **shape** (not just color), supporting accessibility:

| Node | Shape | Pattern/Symbol |
|------|-------|----------------|
| App | Large circle | Solid fill |
| Feature | Rounded rectangle | Solid fill |
| Component | Circle | Solid fill |
| Decision (active) | Diamond | Solid fill |
| Decision (superseded) | Diamond | Dashed stroke, no fill |
| Feature/Component (deprecated) | Same shape as type | Hatched/striped pattern fill |

Shape alone communicates type. Color is supplementary, not required for comprehension. Viz includes a legend. This addresses colorblind accessibility.

---

## ~~What Happens to Deleted Code?~~ — RESOLVED

New `node_removed` event type added. Five event types total: `node_added`, `edge_added`, `node_patched`, `edge_removed`, `node_removed`.

Timeline rendering of deleted nodes:
- At the removal timestamp: rendered in red with aggressive cross-hatch pattern — clear "just deleted" signal
- In subsequent snapshots: gone entirely

`process-staging` implicitly emits `edge_removed` events for all edges connected to a removed node — agent only needs to stage the `[node-removed]` entry.

Decisions that AFFECTED the deleted node become orphaned — their AFFECTS edge has no target. Viz renders orphaned decisions distinctly (dangling edge visual treatment TBD during implementation).

Staging format adds a new entry type:

```markdown
## [node-removed] <uuid>
```

Event types updated:

| Event | Purpose |
|-------|---------|
| `node_added` | Add a node |
| `edge_added` | Add an edge |
| `node_patched` | Update node properties |
| `edge_removed` | Remove an edge |
| `node_removed` | Remove a node (process-staging auto-removes connected edges) |

---

## ~~Missing Staging Entry Types~~ — RESOLVED

Two new entry types added:

- `[deprecate] <old-uuid> <new-uuid>` — emits `edge_added` (DEPRECATES) + `node_patched` (status: deprecated)
- `[resolve-review] <review-id>` with `action: supersede` or `action: dismiss` — supersede emits `node_patched` + `edge_added` (SUPERSEDES); dismiss just removes the review entry

---

## ~~MCP Staleness Logic with Active Sessions~~ — RESOLVED

MCP rejects if `staging/ has files AND sessions.json is empty`. If sessions are active, staging is expected — MCP serves from last-synced `events.jsonl` with a warning: "Active agent sessions — data may not reflect pending changes."

---

## ~~Event Timestamps~~ — RESOLVED

Capture time. Staging entries carry a `timestamp:` field written by the agent at creation time. `process-staging` uses that timestamp for emitted events. If missing, fall back to sync time. This preserves timeline granularity.

---

## ~~Ref Patch Semantics~~ — RESOLVED

`process-staging` builds the graph (already needed for validation), gets the node's current refs, applies add/remove, and emits `node_patched` with the full merged refs array. The event always carries the complete refs state — no incremental array operations in the event schema. Each snapshot's refs are self-contained. Timeline shows refs changing at each patch timestamp.

---

## ~~Alias Collision~~ — RESOLVED

One staging file per agent session (named by session ID), multiple entries per file. Aliases are file-scoped — resolve within the file only. Cross-file references use UUIDs. No collision risk across agents.

---

## ~~sessions.json Creation~~ — RESOLVED

Init creates all `.whygraph/` files: `sessions.json` with `{"active":[]}`, `reviews.jsonl` (empty), `errors.jsonl` (empty). Nothing downstream needs to handle missing files.

---

## ~~get_history Scope~~ — RESOLVED

`get_history` absorbed into `whygraph_context`. The `whygraph_context(file, symbol?)` tool returns decisions affecting the nodes that reference the given file — transitive through the structural hierarchy. No separate `get_history` tool needed.

---

## ~~get_gaps Ordering~~ — RESOLVED

Hierarchical: features first, then top-level components, then deeper components. Interview starts with the broadest architectural gaps.

---

## ~~MCP Tools for Reviews and Errors~~ — RESOLVED

Added `whygraph_get_reviews()` and `whygraph_get_errors()` MCP tools. Keeps the MCP server as the single query interface — no platform-specific filesystem access needed.

Final MCP tool list (5 tools, all read-only):
- `whygraph_context(file, symbol?)` — decisions + node UUIDs for code being touched
- `whygraph_get_decisions(filters)` — broad queries by tag, status, date (tags use OR logic)
- `whygraph_get_gaps(limit?)` — nodes without decisions (interview flow)
- `whygraph_get_reviews()` — pending supersede candidates
- `whygraph_get_errors()` — failed staging entries

---

## ~~Tag Filter MCP: OR or AND~~ — RESOLVED

OR logic, matching viz behavior. `tags: ["security", "data"]` returns decisions with security OR data.

---

## ~~Tag Filtering and Structural Nodes~~ — RESOLVED

Structural nodes remain visible if they have a visible decision OR are an ancestor (via COMPOSES) of a node with a visible decision. Leaf structural nodes with no visible decisions and no visible descendants disappear.

---

## ~~Platform-Specific File Paths~~ — DEFERRED

Exact paths/content for platform-specific files deferred to implementation time. Init specifies *what* gets generated (skill instructions, hook config, MCP config), not *where*. Platform conventions may shift. Developer intervention expected to confirm correct paths.

---

## ~~Sync Interactive Prompting~~ — RESOLVED

Sync reuses `prompts` library (already a dependency) for manual review resolution. Hook-triggered sync skips interactive prompting — reviews accumulate for later resolution.

---

## ~~Browser Opener~~ — RESOLVED

Add `open` npm package as dependency. Handles macOS, Linux, Windows.

---

## ~~Config Platform Migration~~ — RESOLVED

`whygraph config` cleans up old platform files before generating new ones (reads old environment from `config.json`). If environment changes, sync trigger is downgraded if needed (e.g., `hook` → `git-hook` when leaving Claude Code) with a user-facing message.

---

## ~~Agent Affects Resolution~~ — RESOLVED

Decision staging entries support two fields for specifying what they affect:
- `files-touched:` — file paths the agent modified. `process-staging` resolves to node UUIDs via refs (exact file match).
- `affects:` — node UUIDs directly (used in interview flow when agent has UUIDs from `get_gaps`).

One or both must be present. Results are merged. If neither, validation error.

Processing order is global across all staging files (not per-file):
1. `[feature]` entries
2. `[component]` entries
3. `[ref-update]` entries
4. `[deprecate]` entries
5. `[decision]` entries
6. `[resolve-review]` entries
7. `[node-removed]` entries

If `files-touched` can't resolve after structural entries are processed, the entry goes to `errors.jsonl` — the agent needs to map the file first.

---

## ~~Staging File Structure~~ — RESOLVED

Reverted from one-entry-per-file to one-file-per-agent-session. Each agent writes to `staging/session-<id>.md`. Multiple entries per file. Aliases are file-scoped. No write contention across agents.

---

## ~~Multi-Agent Environment~~ — RESOLVED

Staging changed from a single file (`staging.md`) to a directory (`staging/`) with individual files per entry. Eliminates write contention between concurrent agents.

Session coordination via `.whygraph/sessions.json`:
- Agent registers on start, deregisters on turn end (via hook)
- Sync skips if active sessions exist (staging accumulates until all agents are done)
- Crashed sessions cleared explicitly: `whygraph sync` prompts user, `whygraph sync --flush` clears and proceeds
- No TTL — user is always in control of crash recovery
- MCP returns actionable error if stale sessions block sync

---

## ~~Interview Flow Affects~~ — RESOLVED (Pass 2)

Interview decisions use `affects:` with UUIDs from `get_gaps`. Normal work decisions use `files-touched:`. Both fields supported on decision entries, results merged. Same AFFECTS edges in `events.jsonl` either way.

---

## ~~Multi-Agent Sync Processing Order~~ — RESOLVED (Pass 2)

Processing order is global across all staging files. All entries from all session files are collected, then processed by type priority (features → components → ref-updates → deprecations → decisions → review resolutions → node removals). This ensures structural nodes from one agent's file exist before another agent's decisions resolve against them.

---

## ~~whygraph_context File Matching~~ — RESOLVED (Pass 2)

Exact file path match against node refs. No prefix/directory matching. Parent chain discovered via COMPOSES traversal, not path prefix. If no match, error suggests `/whygraph-scan`.

---

## ~~All Tags Off in Viz~~ — RESOLVED (Pass 2)

Message overlay: "No decisions match the current filters." Same behavior whenever tag filtering + any timeline position results in zero visible decisions. Structural nodes hidden but message makes clear it's a filter state.

---

## ~~Tag Filtering + Timeline~~ — RESOLVED (Pass 2)

Same overlay message. Consistent with all-tags-off behavior.

---

## ~~Review Entry Identification~~ — RESOLVED (Pass 2)

Review entries in `reviews.jsonl` get a UUID `id` field assigned by `process-staging` at creation time. `[resolve-review]` references this ID. `whygraph_get_reviews()` returns the IDs.

---

## ~~DEPRECATES Edge Direction~~ — RESOLVED (Pass 2)

New → old, consistent with SUPERSEDES. `[deprecate] <old-uuid> <new-uuid>` emits edge FROM new TO old.

---

## ~~Removing Non-Existent Ref~~ — RESOLVED (Pass 2)

Silent no-op. Defensive behavior, consistent with forward-compatible parsing principle.

---

## ~~Tag Filter State in URL~~ — RESOLVED (Pass 4)

Tag filter state encoded in URL hash for F5 persistence: `#focus=<uuid>&t=<index>&tags=security,data`. JavaScript reads/writes `window.location.hash` — works on `file://` pages, no server needed.

---

## ~~Deprecated Node Side Panel~~ — RESOLVED (Pass 4)

Feature/Component side panel includes:
- Status chip (active/deprecated) next to name
- If deprecated: "Deprecated by: [name]" clickable link
- If this node deprecates another: "Deprecates: [name]" clickable link

Consistent with Decision panel's supersedes/superseded-by links.

---

## ~~Orphaned Decision Removal~~ — RESOLVED (Pass 4)

When a decision loses all its AFFECTS edges (because every node it affected was removed), `process-staging` emits `node_removed` for the decision. The decision disappears from snapshots after the removal timestamp. Earlier timeline snapshots still show it with its edges. No special viz rendering needed — the snapshot model handles it naturally.

---

## ~~Projection on Invalid Sequences~~ — RESOLVED (Pass 4)

Skip and warn. `buildGraph` logs to `console.error` but doesn't throw. Defensive, consistent with forward-compatible parsing. Graph built from whatever valid events exist.

---

## ~~App-Child Components~~ — RESOLVED (Pass 3)

Reserved keyword `parent: app`. `process-staging` resolves it to the App node UUID (first event in events.jsonl). Used for shared components directly under App.

---

## ~~Deprecate with Aliases~~ — RESOLVED (Pass 3)

`[deprecate]` allows aliases for the new-node reference: `[deprecate] <uuid-old> <alias-new>`. Alias resolved within the same file, consistent with `parent` alias resolution.

---

## ~~Auto-Generated Event Timestamps~~ — RESOLVED (Pass 3)

All events emitted from a single staging entry share that entry's timestamp. Node removal + edge removals in same snapshot. Deprecate edge + status patch in same snapshot. Review resolution events in same snapshot.

---

## ~~Focus Shift on Click~~ — RESOLVED (Pass 3)

Clicking any node while focused shifts focus directly to the clicked node. One click to jump anywhere. Faded nodes are clickable.

---

## ~~Focus Auto-Clear on Tag Filter~~ — RESOLVED (Pass 3)

Focus auto-clears when the focused node becomes invisible due to tag filtering. Graph returns to current filter state. Overlay message shown if nothing is visible.

---

## ~~Recursive Node Removal~~ — RESOLVED (Pass 3)

`[node-removed]` recursively removes all COMPOSES descendants. `process-staging` traverses the graph downward, emits `node_removed` + `edge_removed` for every descendant and their edges. Decisions affecting removed descendants lose their AFFECTS edges (become orphaned). "Moving" a component is create-new + remove-old — no move event.

---

## ~~errors.jsonl Clearing~~ — RESOLVED (Pass 3)

`errors.jsonl` is cleared at the start of each sync run. Errors are ephemeral — only meaningful between syncs. `whygraph_get_errors()` returns errors from the most recent sync only.

---

## ~~Duplicate Events on Crash Recovery~~ — RESOLVED (Pass 3)

Before appending new events, `process-staging` checks if any events it's about to emit already exist in `events.jsonl` by comparing timestamp + content hash against recent events. Duplicates are skipped. Staging files are then deleted. If a crash happened after a previous partial append, the dedup check catches it and the staging files are safely cleaned up.

---

## ~~.gitignore for .whygraph/~~ — RESOLVED (Pass 5)

`whygraph init` creates `.whygraph/.gitignore` ignoring: `staging/`, `sessions.json`, `errors.jsonl`, `.lock`, `.sessions-lock`. Committed files: `events.jsonl`, `config.json`, `reviews.jsonl`, `viz/index.html`, `.gitignore`.

---

## ~~Git Hook Conflicts~~ — RESOLVED (Pass 5)

If `.git/hooks/post-commit` already exists, init does not overwrite. Instead prints instructions for the user to add `npx whygraph sync` to their existing hook. If no hook exists, creates one.

---

## ~~MCP Affects Source~~ — RESOLVED (Pass 5)

`process-staging` keeps the decision's `affects` property in sync with AFFECTS edges. When a node removal cascade removes AFFECTS edges, it also emits `node_patched` to update the decision's `affects` array. Property and edges always match. MCP can read either.

---

## ~~sessions.json Concurrent Writes~~ — RESOLVED (Pass 5)

Separate lock file: `.whygraph/.sessions-lock` for session registration/deregistration. Independent from `.whygraph/.lock` (sync). No coupling between session management and sync.

---

## ~~Superseding Already-Superseded Decisions~~ — RESOLVED (Pass 5)

Allowed. No validation on target status. Whygraph represents what happened — it's a mirror, not a gatekeeper. If the graph looks confusing (branching supersede chains), that's a signal for the developer to address. The viz shows it as-is.

---

## ~~Deprecation/Supersede Cycles~~ — RESOLVED (Pass 5)

Allowed. No cycle validation. Same principle — whygraph represents what happened. Circular deprecation is unlikely but structurally valid. The viz shows it, the developer addresses it.

---

## ~~Agent Instructions Incomplete~~ — RESOLVED (Pass 5)

Added two instructions:
- **Map new code**: "When you create a new file or module, stage a `[component]` entry under its parent feature. If you're building an entirely new functional area, stage a `[feature]`. When in doubt, create a component — features are rare."
- **Remove deleted code**: "When you delete an entire module or feature, stage a `[node-removed]` entry."

Total: 7 agent instructions covering all staging entry types.

---

## ~~Decision Date Field~~ — RESOLVED (Pass 6)

`date` is an optional presentational field on decision staging entries. Human-readable label: `"2026-03-21"`, `"September 2025"`, `"Date unknown"`. If absent, derived from `timestamp` as YYYY-MM-DD. `timestamp` is used for timeline ordering and snapshot placement. `date` is for display in viz side panel and MCP responses. `get_decisions` `after`/`before` filters use event timestamp, not presentational date.

---

## ~~Node Removal Event Ordering~~ — RESOLVED (Pass 6)

`process-staging` emits cascade events in order: (a) `node_patched` to update decision `affects` arrays, (b) `edge_removed` for all edges, (c) `node_removed` for nodes (children first, parent last). Ensures clean projection replay.

---

## ~~Reviews Referencing Removed Decisions~~ — RESOLVED (Pass 6)

`process-staging` auto-dismisses reviews in `reviews.jsonl` whose `newDecisionId` or `existingDecisionId` is in the set of nodes being removed. Housekeeping, not a decision — no `[resolve-review]` needed.

---

## ~~Interview Timeline Placement~~ — RESOLVED (Pass 7)

Interview decisions appear in the timeline at their recording timestamp, not at their actual historical date. The `date` field is purely presentational (shown in the side panel). Attempting to place decisions at historical dates would be misleading — the structural nodes they reference may not exist at that point in the timeline. Recording time is the truth for the timeline; `date` provides historical context for the reader.

---

## ~~sessions.json Parse Failure~~ — RESOLVED (Pass 8)

Treat as empty. If sessions.json can't be parsed, log a warning and proceed as if no sessions are active. Safe degradation — worst case is sync fires while an agent is working.

---

## ~~Stale Lock Files~~ — RESOLVED (Pass 8)

Use advisory file locking (`proper-lockfile` npm package or equivalent). Advisory locks auto-release when the process exits, even on crash. Applies to both `.lock` (sync) and `.sessions-lock` (session registration). No stale lock problem. Adds `proper-lockfile` as a dependency.

---

## ~~Empty Decision Fields~~ — RESOLVED (Pass 8)

Allow empty strings. `process-staging` injects placeholder text for empty required fields: "Rationale not supplied" (or field-specific equivalent). The viz shows the placeholder, making the gap visible. Not an error — whygraph represents what happened. Better a recorded decision with missing rationale than no recorded decision.

---

## ~~D3.js Inlining Method~~ — RESOLVED (Pass 9)

D3.js v7 added as npm dependency. At viz bake time, read `node_modules/d3/dist/d3.min.js` and inline it into the HTML. Easy to update versions via `npm update d3`.

---

## ~~MCP Server Without Initialization~~ — RESOLVED (Pass 9)

MCP server starts and stays alive. If `.whygraph/` or `events.jsonl` doesn't exist, all tools return error: "Whygraph not initialized. Run `whygraph init` first." Doesn't crash — platform config stays valid, agent gets actionable message.

---

## ~~General-Purpose Node Patch~~ — RESOLVED (Pass 11)

Added `[patch] <uuid>` staging entry type. Emits `node_patched` with whatever properties are specified. Covers: status reverts, description updates, name changes, or any other property fix. Processing order: after ref-updates, before deprecations (step 4 of 8).
