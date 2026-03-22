# Whygraph — Simulation Pass 4

Fourth simulation. Methodically tracing every entry type through every path, every MCP tool through every state, every viz interaction through every combination.

---

## Entry Type Matrix

Tracing each staging entry type through: agent writes → parser reads → process-staging emits → events.jsonl → projection → viz snapshot.

### `[feature]`

1. Agent writes: `## [feature] Auth\ntimestamp: ...\nalias: auth\ndescription: ...\nrefs:\n  - file: src/auth/` ✅
2. Parser: extracts type=feature, name="Auth", timestamp, alias, description, refs. ✅
3. Process-staging: assigns UUID. Emits `node_added` (Feature, name, description, refs) + `edge_added` (COMPOSES, App → Feature). ✅
4. Events use capture timestamp. ✅
5. Projection: `graph.addNode(uuid, { label: "Feature", name: "Auth", description: "...", refs: [...], status: "active" })`. `graph.addEdgeWithKey(edge-uuid, app-uuid, feature-uuid, { label: "COMPOSES" })`. ✅
6. Viz snapshot: feature appears as rounded rectangle. ✅

**No issues.**

### `[component]`

1. Agent writes: `## [component] OAuth\ntimestamp: ...\nalias: oauth\nparent: auth\ndescription: ...\nrefs:\n  - file: src/auth/oauth.ts, symbol: OAuthProvider` ✅
2. Parser: extracts type=component, name="OAuth", parent="auth" (alias). ✅
3. Process-staging: assigns UUID. Resolves alias "auth" → feature UUID (file-scoped). Emits `node_added` + `edge_added` (COMPOSES, parent → component). ✅

**Checking**: `parent: app` for shared components. Parser sees "app" as the parent value. Process-staging recognizes reserved keyword → resolves to App UUID. ✅

**Checking**: `parent: <uuid>` for components under existing nodes. Parser sees UUID. Process-staging uses directly. ✅

**No issues.**

### `[ref-update]`

1. Agent writes: `## [ref-update] <uuid>\ntimestamp: ...\nadd:\n  - file: src/new.ts, symbol: NewThing\nremove:\n  - file: src/old.ts, symbol: OldThing` ✅
2. Parser: extracts type=ref-update, target=uuid, add list, remove list. ✅
3. Process-staging: builds graph from events.jsonl. Gets current refs for target node. Applies add (append) and remove (filter out, silent no-op if missing). Emits `node_patched` with full merged refs array. ✅

**Checking**: What if the target UUID doesn't exist in events.jsonl? Validation error → errors.jsonl. ✅

**No issues.**

### `[deprecate]`

1. Agent writes: `## [deprecate] <old-uuid> <new-uuid-or-alias>\ntimestamp: ...` ✅
2. Parser: extracts type=deprecate, old=uuid, new=uuid-or-alias. ✅
3. Process-staging: resolves alias if needed (file-scoped). Validates both nodes exist. Emits `edge_added` (DEPRECATES, new → old) + `node_patched` (old node status: deprecated). Both events share entry's timestamp. ✅

**Checking**: What if old node is already deprecated? The node_patched sets status to "deprecated" again — no-op effectively. But now there are two DEPRECATES edges pointing to it (from two different new nodes). Is that valid?

This could happen: v1 deprecated by v2, then v2 deprecated by v3. v1 would have two DEPRECATES edges (from v2 and v3). But that's wrong — v3 deprecates v2, not v1. v1 was already deprecated.

Actually this wouldn't happen in practice. The agent would deprecate v2 in favor of v3 — `[deprecate] <v2-uuid> <v3-uuid>`. v1 stays deprecated by v2. Only one DEPRECATES edge per node being deprecated. ✅

But what if two different new components both deprecate the same old one? That's structurally possible but semantically weird. Not a design gap — just an unusual graph state. ✅

**No issues.**

### `[decision]`

1. Agent writes with `files-touched`:
```
## [decision] Use JWT
timestamp: ...
context: ...
decision: ...
tradeoffs: ...
alternatives: ...
files-touched: src/auth/session.ts, src/auth/oauth/callback.ts
tags: security, arch
```
✅

2. Parser: extracts all fields. ✅
3. Process-staging: resolves files-touched to node UUIDs via refs. Assigns decision UUID. Emits `node_added` (Decision) + `edge_added` (AFFECTS) per resolved node. ✅

**Checking**: `files-touched` resolves to the same node twice (two files both ref'd by the same component). Should emit only one AFFECTS edge, not duplicate. Process-staging deduplicates resolved UUIDs. ✅

**Checking**: Decision with `affects` (interview flow):
```
## [decision] Google OAuth over Auth0
timestamp: ...
context: ...
...
affects: <uuid-comp-oauth>
tags: security, integration
```
Process-staging uses UUID directly. Emits `node_added` + `edge_added` (AFFECTS). ✅

**Checking**: Decision with both `files-touched` and `affects`:
```
files-touched: src/auth/session.ts
affects: <uuid-comp-oauth>
```
Process-staging resolves files-touched, adds affects UUIDs, deduplicates, emits AFFECTS edges. ✅

**Checking**: Decision with `supersedes: <uuid>`. Process-staging validates UUID exists and is a Decision node. Emits additional `edge_added` (SUPERSEDES, new → old) + `node_patched` (old decision status: superseded). ✅

**No issues.**

### `[resolve-review]`

1. Agent writes: `## [resolve-review] <review-uuid>\ntimestamp: ...\naction: supersede` ✅
2. Parser: extracts review ID and action. ✅
3. Process-staging: reads review from reviews.jsonl by ID.
   - Action=supersede: emits `node_patched` (old decision status: superseded) + `edge_added` (SUPERSEDES, new → old). Removes review entry.
   - Action=dismiss: removes review entry. No events.
   ✅

**Checking**: What if the review was already resolved (e.g., two agents both try to resolve the same review)? Process-staging looks up the review ID and it's not found → validation error → errors.jsonl. ✅

**No issues.**

### `[node-removed]`

1. Agent writes: `## [node-removed] <uuid>\ntimestamp: ...` ✅
2. Parser: extracts target UUID. ✅
3. Process-staging: builds graph. Finds node. Recursively collects COMPOSES descendants. For the node and every descendant: emits `node_removed` + `edge_removed` for all connected edges. All events share entry's timestamp. ✅

**Checking**: Removing the App node. Should this be prevented? Removing App would cascade to removing EVERYTHING.

This should be a validation error — App node cannot be removed. ✅ (Needs to be added to validation rules but it's obvious.)

**Checking**: Removing a Decision node. Decisions don't have COMPOSES children. `node_removed` emits `node_removed` + `edge_removed` for AFFECTS edges and any SUPERSEDES edges. ✅

**No issues.**

---

## MCP Tool Matrix

Tracing each tool through all pre-check states.

### Pre-check State: Normal (no staging, no sessions, no reviews, no errors)

All 5 tools: load events, build graph, execute query, return result. ✅

### Pre-check State: Staging files + no sessions (stale)

All 5 tools: reject with "Sync needed." ✅

### Pre-check State: Staging files + active sessions

All 5 tools: warn "data may not reflect pending changes" but serve from events.jsonl. ✅

### Pre-check State: No staging + reviews pending

All 5 tools: include warning "N decisions pending review." ✅

### Pre-check State: No staging + errors exist

All 5 tools: include warning "N staging entries failed validation." ✅

### `whygraph_context(file, symbol?)`

- File matches one component: returns component, parent chain, decisions. ✅
- File matches multiple components: returns all matches with decisions. ✅
- File matches no nodes: error suggesting `/whygraph-scan`. ✅
- File + symbol: matches specific ref entry. ✅
- Symbol provided but not found in refs of matched file: fall back to file-only match? Or error?

The tool matches by file first. If symbol is provided, it narrows to the specific ref. If the symbol doesn't match any ref on the file-matched node, the file match is still valid — the node owns the file. Return the node with a note that the specific symbol wasn't found in refs.

Actually — this is fine. The primary use is file-level. Symbol is for disambiguation when multiple components reference the same file (unlikely but possible). If the symbol doesn't narrow anything, the file match suffices. ✅

### `whygraph_get_decisions(filters)`

- No filters: returns all decisions. ✅
- status="active": filters. ✅
- tags=["security"]: OR match. ✅
- tags=["security","data"]: OR — returns decisions with either tag. ✅
- after="2026-01-01": date filter. ✅
- Combined: status="active" AND tags=["security"] AND after="2026-01-01". ✅
- No matches: empty array. ✅

**No issues.**

### `whygraph_get_gaps(limit?)`

- Graph has 50 nodes, 30 have decisions, 20 don't. Returns 10 (default limit), ordered hierarchically. ✅
- All nodes have decisions: empty array. ✅
- limit=5: returns 5. ✅

**Checking**: Does App count as a gap? App never has AFFECTS edges — it's not a feature or component. Should App be excluded from gap results?

Yes — `get_gaps` should only return Feature and Component nodes. The App node is structural root, not a gap. ✅ (Needs to be explicit in implementation but the design says "nodes that have no AFFECTS edges" and App doesn't need AFFECTS edges by design.)

**No issues.**

### `whygraph_get_reviews()`

- reviews.jsonl has entries: returns them with IDs. ✅
- reviews.jsonl empty: empty array. ✅

**No issues.**

### `whygraph_get_errors()`

- errors.jsonl has entries: returns them with details. ✅
- errors.jsonl empty: empty array. ✅

**No issues.**

---

## Viz Interaction Matrix

### Focus + Tag + Timeline Combinations

| Focus | Tags | Timeline | Expected Result |
|-------|------|----------|----------------|
| None | All on | Max | Full graph, full opacity ✅ |
| None | All on | Mid | Partial graph (nodes that exist at that timestamp) ✅ |
| None | All on | Min | Just App node (or empty if before App) ✅ |
| Feature | All on | Max | Feature subtree spread, rest faded ✅ |
| Feature | All on | Mid (feature exists) | Feature subtree as it existed then, rest faded ✅ |
| Feature | All on | Mid (feature doesn't exist) | Focus auto-clears, partial graph, full opacity ✅ |
| Feature | Some off | Max | Feature subtree filtered by active tags, rest faded or hidden ✅ |
| Feature | Some off | Mid | Combined: feature exists? → filtered subtree. Doesn't exist? → auto-clear ✅ |
| None | All off | Any | Overlay: "No decisions match the current filters." ✅ |
| Feature | All off | Any | Focus auto-clears (no visible decisions → node hidden). Overlay message. ✅ |

**Checking**: URL hash encoding for tag state. Currently `#focus=<uuid>&t=<index>`. Should tag filter state also be in the URL?

If the user has `security` and `data` active, hits F5, the tags reset to all-on. The focus and scrubber position are restored but the tag filter is lost.

Should the URL encode active tags? e.g., `#focus=<uuid>&t=<index>&tags=security,data`

This is a UX question: is tag state important enough to persist across refresh? If the user carefully set up a filtered view, losing it on F5 is frustrating.

⚠️ AMBIGUITY: Should tag filter state be encoded in the URL hash for F5 persistence?

---

## Side Panel Edge Cases

### Deprecated node panel

User clicks a deprecated component.

Panel shows:
- Name (heading) + deprecated status indicator
- Description
- Code refs
- Decisions affecting this node
- DEPRECATES edge: "Deprecated by: [new component name]" (clickable)

⚠️ AMBIGUITY: The side panel section for Feature/Component doesn't mention showing deprecation status or the DEPRECATES relationship. Only the Decision panel mentions supersedes/superseded-by links. The structural node panel needs:
- Status chip (active/deprecated)
- If deprecated: "Deprecated by: [name]" link
- If this node deprecates another: "Deprecates: [name]" link

### Superseded decision panel

User clicks a superseded decision.

Panel shows:
- Title + "superseded" chip
- "Superseded by: [new decision title]" (clickable)
- If it also supersedes an older decision: "Supersedes: [older decision title]" (clickable)

This is already documented. ✅

### Orphaned decision panel

A decision whose AFFECTS target was removed. The decision still exists, but its "Affects" list references a deleted node.

Panel shows:
- Affects list with the deleted node — should show as "[Removed]" or similar, not a broken link

⚠️ AMBIGUITY: How does the viz render affects references to removed nodes? The decision's `affects` property lists the UUID. The node doesn't exist in the current snapshot. Options: show as "[Removed]" text, or hide the reference entirely.

---

## Event Projection Edge Cases

### node_patched on non-existent node

Could happen if events.jsonl is manually edited or corrupted. `buildGraph` encounters a `node_patched` for a node that was never `node_added`.

Should `buildGraph` skip with a warning or throw?

⚠️ AMBIGUITY: Projection behavior on invalid event sequences. Options: skip and warn (defensive), or throw (strict). Defensive is consistent with forward-compatible parsing.

### Duplicate node_added

Two `node_added` events with the same UUID. Could happen from the dedup check failing (e.g., hash collision, though extremely unlikely).

`graph.addNode` would throw (graphology doesn't allow duplicate node keys). `buildGraph` should catch and skip. ✅ (Implementation detail, not design gap.)

---

## Summary

### Pass 4 Ambiguities Found

1. **Tag filter state in URL hash** — should tags be encoded for F5 persistence?
2. **Deprecated node side panel** — panel spec doesn't include deprecation status or DEPRECATES relationship links
3. **Orphaned decision affects display** — how to show affects references to removed nodes
4. **Projection on invalid event sequences** — skip-and-warn (defensive) or throw (strict)

### Observations (Not Ambiguities)

- App node should be excluded from `get_gaps` results (implementation detail)
- App node removal should be prevented by validation (implementation detail)
- `files-touched` resolution should deduplicate when multiple files resolve to the same node (implementation detail)
- `whygraph_context` symbol narrowing is optional — file match is primary (implementation detail)

**This is the cleanest pass yet. Four minor ambiguities, zero hard blockers, zero flow-breaking gaps.**
