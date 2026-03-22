# Whygraph — Simulation Pass 6

Sixth simulation. Focusing on: the complete staging parser contract, the complete event schema, end-to-end data consistency, and any remaining cross-cutting concerns.

---

## Angle 1: Complete Parser Contract

Every staging entry type, every field, traced through the parser.

### Parser Input Rules

- File: `.whygraph/staging/session-<id>.md`
- Entries delimited by `## [type]` headings
- Fields delimited by known keys at line start
- Multiline: continuation lines (not starting with known key or `##`) append to current field
- Known keys: `timestamp:`, `context:`, `decision:`, `tradeoffs:`, `alternatives:`, `files-touched:`, `affects:`, `tags:`, `supersedes:`, `alias:`, `parent:`, `description:`, `refs:`, `add:`, `remove:`, `action:`

### Field Type Parsing

| Field | Type | Parse Rule |
|-------|------|------------|
| `timestamp` | ISO string | Single value |
| `context`, `decision`, `tradeoffs`, `alternatives`, `description` | Multiline string | Join continuation lines |
| `files-touched` | Comma-separated file paths | Split by `,`, trim |
| `affects` | Comma-separated UUIDs | Split by `,`, trim |
| `tags` | Comma-separated tag names | Split by `,`, trim, validate against taxonomy |
| `supersedes` | Single UUID | Single value |
| `alias` | Single string | Single value |
| `parent` | UUID, alias, or `app` | Single value |
| `refs` | List of `- file: path, symbol: name` | YAML-like list items |
| `add` | List of `- file: path, symbol: name` | YAML-like list items (for ref-update) |
| `remove` | List of `- file: path, symbol: name` | YAML-like list items (for ref-update) |
| `action` | `supersede` or `dismiss` | Single value (for resolve-review) |

**Checking**: `files-touched` as comma-separated on a single line:
```
files-touched: src/auth/session.ts, src/auth/oauth/callback.ts
```

What if a file path contains a comma? Unlikely in practice (commas in filenames are rare) but possible. ✅ Acceptable risk — not worth adding quoting syntax.

**Checking**: `affects` as comma-separated UUIDs. UUIDs don't contain commas. ✅

**Checking**: `tags` as comma-separated. Tag names are from a fixed set with no commas. ✅

**Checking**: `refs` list parsing:
```
refs:
  - file: src/auth/oauth.ts, symbol: OAuthProvider
  - file: src/auth/session.ts
```

Each line starting with `  - ` is a list item. Split by `, ` to get key-value pairs. `symbol` is optional. ✅

**Checking**: What if a field is empty?
```
description:
tags:
```

Empty string or empty list. Parser should handle gracefully — `description: ""`, `tags: []`. ✅

### Entry Type Heading Parsing

| Heading | Extracts |
|---------|----------|
| `## [feature] Auth Service` | type=feature, name="Auth Service" |
| `## [component] OAuth Handler` | type=component, name="OAuth Handler" |
| `## [decision] Use JWT over cookies` | type=decision, title="Use JWT over cookies" |
| `## [ref-update] <uuid>` | type=ref-update, target=uuid |
| `## [deprecate] <old-uuid> <new-uuid-or-alias>` | type=deprecate, old=uuid, new=uuid-or-alias |
| `## [resolve-review] <review-uuid>` | type=resolve-review, reviewId=uuid |
| `## [node-removed] <uuid>` | type=node-removed, target=uuid |

**Checking**: The heading after `[type]` carries different meaning per type:
- feature/component/decision: it's the name/title
- ref-update/node-removed: it's a target UUID
- deprecate: two values (old + new)
- resolve-review: review ID

The parser needs type-specific heading extraction. This is clear and unambiguous. ✅

**No parser ambiguities found.**

---

## Angle 2: Complete Event Schema

Every event type, every field, verified against what process-staging emits and what projection.ts consumes.

### node_added

```json
{
  "type": "node_added",
  "timestamp": "2026-03-21T14:05:00Z",
  "id": "uuid",
  "label": "Feature",
  "properties": {
    "name": "Auth",
    "description": "Authentication system",
    "refs": [{"file": "src/auth/", "symbol": null}],
    "status": "active"
  }
}
```

For Decision nodes:
```json
{
  "type": "node_added",
  "timestamp": "2026-03-21T14:10:00Z",
  "id": "uuid",
  "label": "Decision",
  "properties": {
    "title": "Use JWT over cookies",
    "date": "2026-03-21",
    "context": "...",
    "decision": "...",
    "tradeoffs": "...",
    "alternatives": "...",
    "status": "active",
    "affects": ["uuid1", "uuid2"],
    "tags": ["security", "arch"],
    "supersedes": null
  }
}
```

**Checking**: Decision `date` field. The staging format doesn't have a `date:` field. The design's DecisionProperties interface requires `date: string // YYYY-MM-DD`.

Where does `date` come from? Options:
- Derived from `timestamp` (take the date portion of the ISO timestamp)
- A separate `date:` field in the staging entry

The staging format's known keys list doesn't include `date:`. But DecisionProperties requires it.

⚠️ AMBIGUITY: Decision `date` field — is it derived from the capture timestamp, or does the staging entry need a `date:` field? For normal work, deriving from timestamp makes sense (the decision was made today). For interviews capturing historical decisions, the decision might have been made months ago. The interview agent should be able to specify a historical date.

### edge_added

```json
{
  "type": "edge_added",
  "timestamp": "2026-03-21T14:05:00Z",
  "id": "edge-uuid",
  "label": "COMPOSES",
  "from": "parent-uuid",
  "to": "child-uuid"
}
```

✅ Clean. All fields determined by process-staging.

### node_patched

```json
{
  "type": "node_patched",
  "timestamp": "2026-03-21T14:07:00Z",
  "id": "uuid",
  "properties": {
    "refs": [{"file": "src/new.ts", "symbol": "NewThing"}],
    "status": "deprecated"
  }
}
```

Partial properties. Only the changed fields. Projection merges: `graph.mergeNodeAttributes(id, properties)`. ✅

### edge_removed

```json
{
  "type": "edge_removed",
  "timestamp": "2026-03-21T14:15:00Z",
  "id": "edge-uuid"
}
```

✅ Clean.

### node_removed

```json
{
  "type": "node_removed",
  "timestamp": "2026-03-21T14:15:00Z",
  "id": "uuid"
}
```

Projection: `graph.dropNode(id)` — graphology automatically removes all edges connected to the node. But we also emit explicit `edge_removed` events. That means both the explicit events AND the graphology auto-removal happen.

Is this a problem? `graph.dropNode(id)` removes the node and all its edges. If we process `edge_removed` events AFTER `node_removed`, the edges are already gone — graphology would throw on trying to drop a non-existent edge.

⚠️ AMBIGUITY: Event ordering during projection replay. If `node_removed` comes before its auto-generated `edge_removed` events in events.jsonl, the projection drops the node (and its edges via graphology), then encounters `edge_removed` for edges that are already gone.

Options:
- Process `edge_removed` before `node_removed` in the projection (reorder during replay)
- Have `buildGraph` silently skip `edge_removed` for non-existent edges (defensive)
- Don't emit explicit `edge_removed` events — let graphology handle it via `dropNode`

The simplest: **don't emit explicit `edge_removed` for node removals.** `node_removed` is sufficient. `graph.dropNode(id)` cleans up edges. The `node_patched` events for decisions' `affects` arrays are still needed (those are property changes, not edge changes).

Wait — but in the event log, the explicit `edge_removed` events serve a purpose: they make the log self-describing. Someone reading events.jsonl can see exactly which edges were removed. If we only emit `node_removed`, the reader has to know that graphology auto-removes edges.

Alternative: emit both, but ensure `edge_removed` events come BEFORE `node_removed` in the serialized batch. Since process-staging controls the order, it can emit edge removals first, then node removal. The projection replays in order: edges removed, then node removed (which is now a clean removal of a node with no edges). ✅

---

## Angle 3: End-to-End Data Consistency

### Snapshot baking and node attributes

The viz bakes snapshots. Each snapshot has `{ nodes: [...], edges: [...] }`. The nodes array includes all attributes. Let me verify what attributes exist on each node type after projection:

**App node**: `{ label: "App", name: "MyApp", description: "...", refs: [...] }`

**Feature node**: `{ label: "Feature", name: "Auth", description: "...", refs: [...], status: "active" }`

**Component node**: `{ label: "Component", name: "OAuth", description: "...", refs: [...], status: "active" }`

**Decision node**: `{ label: "Decision", title: "Use JWT", date: "2026-03-21", context: "...", decision: "...", tradeoffs: "...", alternatives: "...", status: "active", affects: ["uuid1"], tags: ["security"], supersedes: null }`

The viz side panel reads these attributes. The format is consistent. ✅

### Snapshot edges

Each edge: `{ id: "edge-uuid", label: "COMPOSES", from: "uuid", to: "uuid" }`

D3 needs `source` and `target`, not `from` and `to`. The viz code would map `from → source` and `to → target` during rendering.

This is an implementation detail, not a design gap. ✅

---

## Angle 4: Cross-Cutting Concerns

### What happens to reviews.jsonl when a decision is removed?

A review references `newDecisionId` and `existingDecisionId`. If either decision is removed (via node removal cascade), the review references a non-existent node.

When the agent tries to resolve it via `[resolve-review]`, process-staging would try to emit events for nodes that don't exist.

⚠️ AMBIGUITY: Should process-staging clean up reviews.jsonl when referenced decisions are removed? If a decision in a review is removed, the review is moot — it should be auto-dismissed.

### What happens to errors.jsonl across multiple syncs?

errors.jsonl is cleared at the start of each sync. If the agent never re-stages the failed entry, the error disappears silently. The agent might not notice.

But we already resolved this — errors.jsonl is ephemeral. The MCP warns about errors. If the agent doesn't fix it, the error clears on next sync and the staging entry is already deleted. The failed entry is lost.

Wait — sync step 8 says "Invalid entries → errors.jsonl with validation error details (delete their staging files)." The staging file is deleted even for invalid entries. The error record in errors.jsonl is the only record of what failed. When errors.jsonl is cleared on next sync, the failed entry is permanently lost.

Is this a problem? The agent wrote a bad entry, it failed validation, the error was surfaced, the agent didn't fix it, and on next sync it's gone. The information loss is: one malformed staging entry.

This seems acceptable — the agent should fix errors when surfaced. If it doesn't, the entry wasn't important enough to persist. ✅

### MCP server process management

The MCP server runs as `whygraph mcp` — a subprocess spawned by the agent platform. It stays alive for the duration of the session.

But `whygraph sync` writes to events.jsonl and may modify reviews.jsonl. The MCP server reads these files on every tool call. No file locking between the MCP reader and the sync writer.

Is this safe? `fs.appendFile` for events.jsonl is atomic at small sizes. The MCP server reads the file from the beginning each time (`loadEvents()`). Even if sync appends while MCP is reading, the worst case is MCP gets a partial last line — which `loadEvents()` handles by skipping malformed trailing lines.

For reviews.jsonl: sync writes (appends reviews, removes resolved reviews). MCP reads. If MCP reads while sync is writing, it could get a partial file. But reviews.jsonl is small and writes are fast.

This is acceptable at expected scale. Not an ambiguity. ✅

---

## Angle 5: Viz Rendering Edge Cases (Revisited)

### App node in tag filtering

Tag filtering hides structural nodes without visible decisions or visible descendants. The App node has no decisions. When all tags are on, it's visible because it has descendants with decisions. When all tags are off, the overlay message appears.

But what about a partial filter where the only visible decisions are on shared components (directly under App, not under any feature)? The App node and those components are visible, but all features are hidden.

This is correct behavior — the filter shows the security slice, and if only shared components have security decisions, that's what you see. ✅

### Drag persistence across scrubbing

User drags a node to a new position. Then scrubs the timeline. The D3 simulation restarts with the new snapshot. Does the manually positioned node return to its force-directed position, or does the drag persist?

Drag positions are lost on re-render (timeline scrub triggers a full D3 update). This is standard D3 behavior. Not a gap — just expected. ✅

---

## Summary

### Pass 6 Ambiguities Found

1. **Decision `date` field** — missing from staging format. Needs to be a field (for historical interviews) or derived from timestamp (for normal work).
2. **Event ordering for node removal** — `edge_removed` events must come before `node_removed` in the serialized batch to avoid projection errors.
3. **Reviews referencing removed decisions** — should be auto-dismissed during node removal cascade.

### Observations (Not Ambiguities)

- Parser contract is clean and unambiguous
- Event schema is consistent with projection logic
- Snapshot format maps cleanly to D3 (with trivial from→source mapping)
- MCP/sync concurrent access is safe at expected scale
- errors.jsonl information loss on clear is acceptable

**Three ambiguities. Converging toward zero.**
