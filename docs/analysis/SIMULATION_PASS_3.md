# Whygraph — Simulation Pass 3

Third simulation against the updated design. Tracing every flow, traversing every branch.

---

## Flow 1: Fresh Init

1. User runs `npx whygraph init`. ✅
2. `.whygraph/events.jsonl` doesn't exist → fresh init. ✅
3. Guided prompts collect: environment, sync trigger, context injection, autonomy, app name. ✅
4. Creates `.whygraph/` with: events.jsonl, staging/, config.json, sessions.json, reviews.jsonl, errors.jsonl, viz/. ✅
5. Writes App `node_added` to events.jsonl with `crypto.randomUUID()`. ✅
6. Generates platform files. ✅
7. Installs hooks. ✅
8. Bakes initial viz (App node only). ✅
9. Opens viz in browser via `open` package. ✅
10. Prints `/whygraph-scan` instructions. ✅

**Checking**: The App node event needs a timestamp. Init writes it with the current ISO timestamp. ✅

**Checking**: The App node needs properties: `{ name: "MyApp" }`. The `name` comes from the guided prompt. ✅

**No issues.**

---

## Flow 2: Idempotent Init

1. User runs `npx whygraph init` again. ✅
2. events.jsonl exists → idempotent path. ✅
3. Reads config.json. Checks hooks, platform files. Repairs if needed. ✅
4. Checks graph for features → if none, directs to `/whygraph-scan`. ✅

**Checking**: idempotent init doesn't re-prompt. It reads existing config and repairs silently.

⚠️ AMBIGUITY: If the user wants to change their config during idempotent init (e.g., switch from Cursor to Claude Code), they can't — init skips prompts. They'd need to use `whygraph config`. Is that documented clearly enough? The init section says "checks for config drift / missing hooks / platform file staleness, repairs as needed." It doesn't say "re-prompts." This is correct behavior — `whygraph config` handles preference changes. But should idempotent init mention this? This is a documentation concern, not a design gap. Moving on.

**No issues.**

---

## Flow 3: Codebase Scan

1. Agent registers session. Writes to sessions.json. ✅
2. Agent reads codebase, proposes tree. ✅
3. User confirms. ✅
4. Agent writes to `staging/session-<id>.md`:
   - Multiple `[feature]` entries with aliases, refs (directory-level).
   - Multiple `[component]` entries with aliases, parents (alias or App UUID), refs (file+symbol).
   ✅

5. Agent finishes turn → deregisters → hook fires sync. ✅
6. Sync: sessions empty → proceed → read staging → global processing order → features first → components second → assign UUIDs → resolve aliases within file → emit events → atomic append → clear staging. ✅

**Checking**: The scan agent needs the App UUID to set `parent` on top-level features. How does it get it?

The agent calls `whygraph_context`? No — there are no files mapped yet. The agent calls... what? The MCP server has no "get app node" tool.

Wait — for the scan, the agent is writing `[feature]` entries. Features get COMPOSES edges to the App node. `process-staging` reads the App UUID from events.jsonl (first event). The agent doesn't need to specify a parent for features — `process-staging` knows the App UUID.

But for components directly under App (shared utilities), the agent needs to specify `parent: <app-uuid>`. The agent doesn't have the App UUID.

⚠️ AMBIGUITY: How does the agent know the App node's UUID? Options:
- `whygraph_context` doesn't help (no files mapped yet)
- A special alias like `parent: app` that process-staging resolves to the App UUID
- `whygraph_get_gaps` returns the App node (it has no decisions)
- A new MCP tool `whygraph_get_root()` that returns the App UUID

Actually — `[feature]` entries don't need a `parent` field at all. Features always compose to the App. `process-staging` handles this automatically. The staging format example doesn't show a `parent` field on features. ✅

For components directly under App: the agent could use a reserved alias `parent: app` that `process-staging` resolves to the App UUID. Or `process-staging` could accept `parent: app` as a special case.

But wait — looking at the staging format more carefully: `[feature]` entries have no `parent` field. Only `[component]` entries have `parent`. If a component is directly under the App, the agent needs the App UUID or a reserved keyword.

⚠️ AMBIGUITY: How does an agent specify that a component's parent is the App node? Reserved keyword `parent: app`? Or must the agent somehow obtain the App UUID?

---

## Flow 4: Normal Agent Work

### 4.1 Context Query

1. Agent registers session. ✅
2. Agent is about to edit `src/auth/oauth/provider.ts`. ✅
3. Agent calls `whygraph_context(file: "src/auth/oauth/provider.ts")`. ✅

**MCP pre-checks**:
- Staging has files? The agent just registered and might have written nothing yet. Staging dir empty → no issue. But if this is the agent's second turn and the previous turn's staging was synced, staging is empty. ✅
- If staging has files from THIS session (agent wrote entries earlier in same turn): sessions are active → MCP warns but serves. ✅

4. MCP builds graph from events.jsonl. Searches refs for exact match `src/auth/oauth/provider.ts`. Finds comp-oauth. Traverses COMPOSES up to feat-auth → App. Collects all AFFECTS decisions. Returns. ✅

**Checking**: What if the file matches multiple components? E.g., `src/shared/utils.ts` is in refs of both `comp-utils` and `comp-helpers` (different components both reference the same file).

This shouldn't happen — a file should belong to one component. But nothing prevents it. If it does happen, `whygraph_context` should return both nodes and their decisions. The agent gets a broader context. Not an error, just a wider result. ✅

### 4.2 Agent Works and Stages

1. Agent writes code. ✅
2. Agent stages decisions with `files-touched` and/or new components. ✅
3. Agent stages ref-updates for modified files. ✅

**Checking**: The agent creates a new file `src/auth/oauth/pkce.ts`. It stages:
- `[component]` for the new PKCE handler with refs pointing to the new file
- `[decision]` with `files-touched: src/auth/oauth/pkce.ts`

Processing order: component first → ref exists → decision resolves. ✅

**Checking**: The agent renames a function. Old: `handleAuth`. New: `processAuth`. It stages:
- `[ref-update]` with `remove: src/auth/handler.ts, symbol: handleAuth` and `add: src/auth/handler.ts, symbol: processAuth`

`process-staging` builds graph, gets current refs for the node, applies remove+add, emits `node_patched` with full merged refs. ✅

**Checking**: Remove targets a ref that doesn't exist → silent no-op. ✅

### 4.3 Session End + Sync

1. Agent finishes turn → deregisters. ✅
2. Hook fires sync. ✅
3. Sessions empty → proceed. ✅
4. Process staging globally. ✅
5. Supersede check on new decisions. ✅
6. Atomic append. ✅
7. Inject stale banner if viz exists. ✅
8. Clear staging. ✅

**No issues.**

---

## Flow 5: Interview

1. Agent registers session. ✅
2. Agent calls `whygraph_get_gaps(10)`. ✅

**Checking**: MCP pre-checks. Staging empty (fresh session). Sessions active (this one). No staging files → MCP serves normally. ✅

3. Gets back nodes with no decisions, ordered hierarchically. Each node has UUID, name, type. ✅
4. Agent walks through with user. ✅
5. Agent writes staging with `affects: <uuid>` (not `files-touched`). ✅

```markdown
## [decision] Google and GitHub as OAuth providers over Auth0
timestamp: 2026-03-21T10:15:00Z
context: ...
decision: ...
tradeoffs: ...
alternatives: ...
affects: <uuid-of-comp-oauth>
tags: security, integration
```

**Checking**: This decision has `affects` but no `files-touched`. Validation passes because at least one is present. ✅

**Checking**: `process-staging` resolves `affects` UUIDs directly — no file lookup needed. Emits `node_added` (Decision) + `edge_added` (AFFECTS comp-oauth). ✅

**Checking**: Supersede check — are there existing decisions affecting comp-oauth? If this is the first interview, there shouldn't be. But if the user runs interview twice and covers the same node with a different decision, there could be overlap → goes to reviews.jsonl. ✅

6. Agent deregisters → sync → processes. ✅

**No issues.**

---

## Flow 6: Multi-Agent with Cross-Dependencies

Agent A (Claude Code) creates a new component. Agent B (Cursor) writes a decision about code that maps to that component.

1. Agent A registers session-aaa. Agent B registers session-bbb. ✅
2. Agent A writes `staging/session-aaa.md`:

```markdown
## [component] Rate Limiter
timestamp: ...
alias: rate-limiter
parent: <uuid-feat-api>
refs:
  - file: src/api/middleware/rate-limiter.ts, symbol: RateLimiter
```

3. Agent B writes `staging/session-bbb.md`:

```markdown
## [decision] Token bucket over sliding window for rate limiting
timestamp: ...
context: ...
decision: ...
tradeoffs: ...
alternatives: ...
files-touched: src/api/middleware/rate-limiter.ts
tags: performance
```

4. Agent A finishes → deregisters → sync skips (B still active). ✅
5. Agent B finishes → deregisters → sync proceeds. ✅
6. Global processing order: components from all files first → Agent A's `[component]` processed → rate-limiter node exists with refs. Then decisions → Agent B's `[decision]` processed → `files-touched: src/api/middleware/rate-limiter.ts` resolves to rate-limiter node. ✅

**No issues.**

---

## Flow 7: Deprecation

1. Agent detects `comp-api-v1` deprecated by `comp-api-v2`.
2. Agent has both UUIDs (from `whygraph_context` calls during work).
3. Agent writes:

```markdown
## [deprecate] <uuid-v1> <uuid-v2>
timestamp: ...
```

4. Sync processes: emits `edge_added` (DEPRECATES, from v2 → v1) + `node_patched` (v1 status: deprecated). ✅

**Checking**: What if v2 doesn't exist yet? The agent is creating v2 AND deprecating v1 in the same staging file.

```markdown
## [component] API v2 Client
timestamp: ...
alias: api-v2
parent: <uuid-feat-api>
refs:
  - file: src/api/v2/client.ts, symbol: ApiV2Client

## [deprecate] <uuid-v1> api-v2
timestamp: ...
```

Wait — `[deprecate]` takes two UUIDs. But `api-v2` is an alias, not a UUID. Can `[deprecate]` use aliases?

⚠️ AMBIGUITY: `[deprecate] <old-uuid> <new-uuid>` — can the new-uuid be an alias? If the new component is created in the same staging file, the agent only has an alias, not a UUID. Options:
- Allow aliases in `[deprecate]` entries (process-staging resolves them)
- Require UUIDs only (agent must split across two sync cycles)

Allowing aliases is consistent with how `parent` works on components. Aliases are file-scoped. If the alias is in the same file, it should resolve.

---

## Flow 8: Review Resolution

1. `reviews.jsonl` has: `{"id":"rev-001","newDecisionId":"uuid-new","existingDecisionId":"uuid-old","sharedNodeIds":["uuid-comp"],"status":"pending"}` ✅
2. Agent calls `whygraph_get_reviews()`. Gets the review with ID `rev-001`. ✅
3. Agent presents to user. User confirms supersede. ✅
4. Agent writes:

```markdown
## [resolve-review] rev-001
timestamp: ...
action: supersede
```

5. Sync processes: reads review `rev-001` from reviews.jsonl → gets `newDecisionId` and `existingDecisionId` → emits `node_patched` (old decision status: superseded) + `edge_added` (SUPERSEDES, new → old) → removes review entry from reviews.jsonl. ✅

**Checking**: What if the review ID doesn't exist in reviews.jsonl? (Agent typo, or review was already resolved.)
→ Validation error. Entry goes to errors.jsonl. ✅

**Checking**: What if user dismisses?

```markdown
## [resolve-review] rev-001
timestamp: ...
action: dismiss
```

Sync removes the review entry. No events emitted. ✅

**No issues** (assuming aliases are allowed in deprecate — see Flow 7 ambiguity).

---

## Flow 9: Node Removal

1. Agent deletes `src/auth/oauth/legacy.ts` entirely.
2. Agent knows this file belonged to `comp-legacy-oauth` (from `whygraph_context` call).
3. Agent writes:

```markdown
## [node-removed] <uuid-comp-legacy-oauth>
timestamp: ...
```

4. Sync processes: emits `node_removed` + queries graph for all edges connected to this node → emits `edge_removed` for each. ✅

**Checking**: What about decisions that AFFECT the removed node? Their AFFECTS edge is removed by the auto-generated `edge_removed`. The decision node still exists but now has a dangling AFFECTS (edge removed, but the decision's `affects` property still lists the UUID).

⚠️ AMBIGUITY: Should `process-staging` also patch the decision's `affects` property to remove the deleted node's UUID? Or is the edge removal sufficient? The graph projection won't have the edge (it was removed), but the decision's serialized `affects` array in its `node_added` event still lists it.

Actually — the graph is built from events. The `node_added` event for the decision has `affects: [uuid-of-removed-node]`. But the `edge_removed` event removes the AFFECTS edge. So the graph correctly shows no edge. The `affects` property on the decision is the original data — it's historical. It says "this decision was originally about this node." The edge being gone means the relationship is no longer active in the graph.

This is actually correct — the decision records what it originally affected, but the graph structure reflects the current state. The viz would show the decision with no visible AFFECTS edge to the removed node (because the node and edge are gone).

No issue. The event log preserves history. The projection reflects current state. ✅

---

## Flow 10: Viz Bake

1. User runs `npx whygraph viz`. ✅
2. Check staging: empty → proceed. ✅ (Or staging + sessions active → warn but bake. ✅)
3. Read events.jsonl. Parse all events. ✅
4. Group by unique timestamp. ✅

**Checking**: Events now have capture timestamps (varying). If Agent A and Agent B had entries processed in the same sync, their events have different timestamps (capture time). Each unique timestamp gets a snapshot. This means a sync of 10 events with 10 different timestamps creates 10 snapshots. ✅

**Checking**: What about events generated by `process-staging` itself — like the auto-generated `edge_removed` events from `[node-removed]`? What timestamp do they get?

⚠️ AMBIGUITY: Auto-generated events (like `edge_removed` from a `[node-removed]` entry) — do they share the timestamp of the staging entry that triggered them? Or do they get the sync time?

They should share the staging entry's timestamp. The node removal and its edge removals should appear in the same snapshot — they happened together.

5. For each unique timestamp, replay all events up to and including that timestamp via `buildGraphAt`. ✅
6. Produce SNAPSHOTS array. ✅
7. Check reviews.jsonl for count. ✅
8. Generate HTML with inline D3, snapshots, bake timestamp, review count, legend, tag filter bar, scrubber, side panel, focus+context JS, URL hash management. ✅
9. Write to `.whygraph/viz/index.html`. ✅
10. Open in browser via `open` package. ✅

**No issues** (assuming auto-generated events share parent timestamp).

---

## Flow 11: Viz Interaction (Thorough Walkthrough)

### 11.1 Load

1. Browser opens `file:///path/to/.whygraph/viz/index.html`. ✅
2. Check URL hash for state. No hash → default view. ✅
3. Render last snapshot (scrubber at max). ✅
4. D3 force simulation starts. App centered. Features space out. Components cluster. Decisions float near affected nodes. ✅
5. Legend visible. Tag bar visible (all on). Scrubber at bottom. Bake timestamp in footer. ✅
6. If REVIEW_COUNT > 0 → review banner visible. ✅
7. If stale banner was injected → stale banner visible. ✅

### 11.2 Focus Interaction

1. User clicks Feature (rounded rectangle). ✅
2. Subtree spreads. Everything else fades. View recenters. Side panel slides in. ✅
3. URL hash updates: `#focus=<feature-uuid>&t=<max-snapshot>`. ✅
4. User clicks Component within feature. ✅
5. That component's children spread. Siblings compress. View recenters. Panel updates. ✅
6. User clicks Decision diamond. Panel shows decision detail with collapsible sections. ✅
7. User clicks "Affects" chip in panel → focus shifts to that node. ✅
8. User clicks background → unfocus, full graph, panel closes. ✅

**Checking**: When focused and user clicks a different top-level feature — does it shift focus directly, or unfocus first then focus?

⚠️ AMBIGUITY: Clicking a non-descendant node while focused. Does it (a) shift focus to the new node, or (b) unfocus first, then require a second click? (a) is smoother UX — one click to jump between features.

### 11.3 Tag Filtering

1. User toggles off "ux" tag. ✅
2. Decisions tagged only "ux" disappear. Their affected structural nodes... check visibility rule: node remains if it has a visible decision OR is an ancestor of a visible node. ✅
3. Structural nodes with no visible decisions and no visible descendants disappear. ✅
4. COMPOSES chain to App preserved for visible nodes. ✅

**Checking**: User is focused on a feature, then toggles off tags such that all decisions in that feature disappear. Focus target has no visible decisions.

⚠️ AMBIGUITY: Does the feature itself disappear (no visible decisions or descendants)? If so, focus is on a node that no longer renders. Should focus auto-clear when the focused node becomes invisible due to tag filtering?

### 11.4 Timeline + Focus

1. User is focused on feat-auth. Scrubs backward. ✅
2. Components in feat-auth disappear as the timeline moves back. ✅
3. feat-auth itself disappears when scrubbed before its creation. ✅
4. Focus clears (focused node doesn't exist). Everything at full opacity. ✅

**Checking**: User scrubs forward past a `node_removed` event. The removed node rendered in red cross-hatch at the removal timestamp. Next snapshot: gone. If the user was focused on a component under the removed node, does focus clear?

The removed node is gone from the snapshot. Its COMPOSES children should also be gone (they were removed via auto-generated edge_removed events... wait, `[node-removed]` removes the node and its edges, but not its children nodes. The children still exist — they just lost their COMPOSES parent edge).

⚠️ AMBIGUITY: When a node is removed, `process-staging` emits `edge_removed` for all connected edges. But the node's COMPOSES children still exist as nodes — they just have no parent edge. They become orphaned structural nodes in the graph. Should `[node-removed]` recursively remove children? Or do orphaned children remain?

---

## Flow 12: Error Recovery

### 12.1 Staging Validation Failure

1. Agent writes a decision missing `context`. ✅
2. Sync validates → fails → moves to errors.jsonl. Staging file deleted. ✅
3. Next MCP call warns: "1 staging entry failed validation." ✅
4. Agent calls `whygraph_get_errors()`. Gets the error with details. ✅
5. Agent rewrites the entry correctly. New staging file. ✅
6. Next sync processes successfully. ✅

**Checking**: The error entry in errors.jsonl — does it persist forever? Or is it cleared when the agent rewrites?

⚠️ AMBIGUITY: errors.jsonl entries are never cleared. They accumulate. There's no `[resolve-error]` entry type or mechanism to clear them. The agent rewrites the staging entry and it succeeds on next sync, but the old error stays in errors.jsonl. Eventually the MCP warning becomes noise.

Options: (a) `process-staging` clears errors.jsonl at the start of each run — errors are ephemeral, only relevant until next sync. (b) Errors persist and need explicit clearing. (c) Agent writes a `[clear-errors]` staging entry.

(a) is simplest — errors are only meaningful between syncs. Once a new sync runs, old errors are stale.

### 12.2 Crashed Session

1. Agent crashes. Session stays in sessions.json. ✅
2. User notices (MCP error or sync prompt). ✅
3. User runs `whygraph sync`. Sees stale session. Confirms flush. ✅
4. Or: `whygraph sync --flush`. ✅
5. Sessions cleared. Staging processed. ✅

**Checking**: The crashed agent's staging file still exists in `staging/`. It might be incomplete (agent crashed mid-write).

⚠️ AMBIGUITY: A crashed agent's staging file might have a partially written entry (e.g., cut off mid-line). The parser will encounter a malformed entry. This should go to errors.jsonl. Valid entries in the same file should still process.

The current design says invalid entries go to errors.jsonl and valid entries are processed. But the parser needs to handle partial entries gracefully — not crash itself on malformed markdown. This is an implementation detail (robust parsing) not a design gap. ✅

### 12.3 Partial Event Append

1. `fs.appendFile` crashes mid-write. ✅
2. Last line in events.jsonl is malformed. ✅
3. Next `loadEvents()` skips malformed trailing line. ✅
4. Lost events: the batch that was being written. Staging files were already deleted (step 12 in sync happens after step 10 append).

Wait — sync step 12 (delete staging) happens after step 10 (append). If the crash happens during step 10, staging is NOT yet deleted. On next sync, the staging files are re-processed. Duplicate events?

⚠️ AMBIGUITY: If `fs.appendFile` partially writes and sync crashes between steps 10 and 12, the next sync re-reads the same staging files. Some events from those files are already in events.jsonl (the partial append succeeded for some). Re-processing would create duplicate nodes/edges.

`process-staging` should check if the events it's about to emit already exist in events.jsonl (by matching staging entry content to recent events). Or: staging files should be deleted BEFORE appending events, with a recovery mechanism. Or: use a write-ahead log pattern.

This is a genuine edge case. The atomic append (single `fs.appendFile`) makes partial writes unlikely at small batch sizes. But it's not impossible.

Simplest mitigation: `process-staging` assigns UUIDs deterministically from the staging content (e.g., hash of entry content) rather than randomly. If a duplicate UUID appears during replay, the projection skips it. But this changes ID generation.

Alternative: accept the risk. At expected scale and crash frequency, this is a theoretical concern.

---

## Flow 13: Config Change

1. User runs `whygraph config --environment cursor`. ✅
2. Reads config.json. Old environment: claude-code. ✅
3. Updates environment to cursor. ✅
4. Sync trigger was `hook` (Claude Code only) → downgrades to `git-hook`. ✅
5. Removes Claude Code platform files. ✅
6. Generates .cursorrules. ✅
7. Installs git hook at `.git/hooks/post-commit`. ✅
8. Removes Claude Code hook from settings.json. ✅
9. Writes updated config.json. ✅

**No issues.**

---

## Summary

### New Ambiguities (Pass 3)

1. **App-child components need a way to specify App as parent** — reserved keyword `parent: app` or similar
2. **`[deprecate]` with aliases** — should allow aliases for the new-node reference when created in same file
3. **Auto-generated event timestamps** — should share the parent staging entry's timestamp
4. **Clicking non-descendant while focused** — should shift focus directly (one click)
5. **Focus target disappears due to tag filtering** — focus should auto-clear
6. **Node removal doesn't cascade to children** — orphaned children remain in graph
7. **errors.jsonl never cleared** — should clear at start of each sync
8. **Duplicate events on crash recovery** — staging re-processed after partial append

### Consistency Issues

1. Review resolution section (line ~317-320) still describes old flow — should only reference `[resolve-review]` (partially fixed but line 319 still says "Agent writes `node_patched`...")
