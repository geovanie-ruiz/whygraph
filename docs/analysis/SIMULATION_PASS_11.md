# Whygraph — Simulation Pass 11

Eleventh simulation. Previous passes covered: all flows (1-3), all entry types (4), all MCP states (4), all viz interactions (4), user mental model (7), adversarial inputs (5,7), state machines (8), dependency inventory (9), regression check (10), first 30 minutes (10).

Approaching from the last untested angles: the exact bytes in every file format, team workflow scenarios, and edge cases in the viz bake process itself.

---

## Angle 1: Exact File Format Verification

Checking every file format for completeness and parsability.

### events.jsonl — every event type serialized

**node_added (App)**:
```json
{"type":"node_added","timestamp":"2026-03-21T10:00:00Z","id":"550e8400-e29b-41d4-a716-446655440000","label":"App","properties":{"name":"MyProject"}}
```
Init writes this. No status, no refs. ✅

**node_added (Feature)**:
```json
{"type":"node_added","timestamp":"2026-03-21T14:05:00Z","id":"6ba7b810-9dad-11d1-80b4-00c04fd430c8","label":"Feature","properties":{"name":"Authentication","description":"User auth and session management","refs":[{"file":"src/auth/"}],"status":"active"}}
```
✅

**node_added (Component)**:
```json
{"type":"node_added","timestamp":"2026-03-21T14:06:00Z","id":"6ba7b811-9dad-11d1-80b4-00c04fd430c8","label":"Component","properties":{"name":"OAuth Provider","description":"OAuth provider integration","refs":[{"file":"src/auth/oauth/provider.ts","symbol":"OAuthProvider"}],"status":"active"}}
```
✅

**node_added (Decision)**:
```json
{"type":"node_added","timestamp":"2026-03-21T14:10:00Z","id":"6ba7b812-9dad-11d1-80b4-00c04fd430c8","label":"Decision","properties":{"title":"Use JWT over session cookies","date":"2026-03-21","context":"Session cookies don't work well with mobile clients...","decision":"Use JWT tokens for authentication...","tradeoffs":"Gained stateless auth, lost easy revocation...","alternatives":"Session cookies (rejected: ...)...","status":"active","affects":["6ba7b811-9dad-11d1-80b4-00c04fd430c8"],"tags":["security","arch"]}}
```

**Checking**: `supersedes` field — if null/absent, is it omitted from JSON or explicitly `null`? Forward-compatible parsing means the field may be missing. `JSON.stringify` omits `undefined` fields. If `supersedes` is not set, it simply doesn't appear in the JSON line. `loadEvents` parses and `buildGraph` handles missing fields with defaults. ✅

**edge_added**:
```json
{"type":"edge_added","timestamp":"2026-03-21T14:05:00Z","id":"edge-7c9e6679-7425-40de-944b-e07fc1f90ae7","label":"COMPOSES","from":"550e8400-e29b-41d4-a716-446655440000","to":"6ba7b810-9dad-11d1-80b4-00c04fd430c8"}
```
✅

**node_patched**:
```json
{"type":"node_patched","timestamp":"2026-03-21T15:00:00Z","id":"6ba7b812-9dad-11d1-80b4-00c04fd430c8","properties":{"status":"superseded"}}
```
Partial properties. Only changed fields. ✅

**edge_removed**:
```json
{"type":"edge_removed","timestamp":"2026-03-21T16:00:00Z","id":"edge-7c9e6679-7425-40de-944b-e07fc1f90ae7"}
```
✅

**node_removed**:
```json
{"type":"node_removed","timestamp":"2026-03-21T16:00:00Z","id":"6ba7b811-9dad-11d1-80b4-00c04fd430c8"}
```
✅

All five event types serialize cleanly as single-line JSON. ✅

### config.json

```json
{
  "appName": "MyProject",
  "environment": "claude-code",
  "syncTrigger": "hook",
  "contextInjection": "always",
  "autonomy": "supervised"
}
```
Pretty-printed JSON (not JSONL). Read/written as a whole file. ✅

### sessions.json

```json
{
  "active": [
    {"id": "session-550e8400", "startedAt": "2026-03-21T14:00:00Z", "platform": "claude-code"}
  ]
}
```
Pretty-printed JSON. Read-modify-write under .sessions-lock. ✅

### reviews.jsonl

```
{"id":"rev-550e8400","newDecisionId":"6ba7b812","existingDecisionId":"6ba7b813","sharedNodeIds":["6ba7b811"],"status":"pending"}
```
JSONL. Appended by sync. Individual lines removed when reviews are resolved or auto-dismissed.

**Checking**: Removing a specific line from a JSONL file. This requires reading the whole file, filtering out the resolved review, and writing back. Not an append operation — it's a rewrite.

Is this safe? reviews.jsonl is only written by sync (which holds .lock). No concurrent writers. Read-filter-write is fine under the lock. ✅

### errors.jsonl

```
{"entry":"## [decision] Bad entry\ncontext:\ndecision: did a thing","error":"Empty required field: context (injected placeholder)","file":"staging/session-abc.md"}
```

Wait — we said empty fields get placeholder text injected, not sent to errors. Let me re-check.

We resolved: "Allow empty strings. `process-staging` injects placeholder text for empty required fields." This means empty fields are NOT errors — they get placeholders and proceed. errors.jsonl only captures entries that fail validation for other reasons (missing entry type, unresolvable parent, invalid UUID reference, etc.).

So the error example should be something like:
```
{"entry":"## [decision] Bad entry\nfiles-touched: nonexistent.ts","error":"File not found in any node's refs: nonexistent.ts","file":"staging/session-abc.md"}
```
✅

### .gitignore

```
staging/
sessions.json
errors.jsonl
.lock
.sessions-lock
```
✅

### viz/index.html structure

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Whygraph — MyProject</title>
  <style>
    /* All CSS inline: layout, side panel, scrubber, legend, tag bar, banners, overlays */
  </style>
</head>
<body>
  <div id="tag-bar"><!-- 7 tag chips --></div>
  <div id="legend"><!-- shape/color/pattern legend --></div>
  <svg id="graph"><!-- D3 renders here --></svg>
  <div id="side-panel"><!-- slides in on click --></div>
  <div id="timeline">
    <span id="timeline-label"></span>
    <input type="range" id="scrubber" />
  </div>
  <div id="overlay" style="display:none"><!-- filter message --></div>
  <div id="stale-banner" style="display:none"><!-- injected by sync --></div>
  <div id="review-banner" style="display:none"><!-- baked in if reviews pending --></div>
  <footer>Last updated: 2026-03-21T15:00:00Z</footer>

  <script>
    // Inline D3.js v7 (~280KB minified)
  </script>
  <script>
    const SNAPSHOTS = [/* baked snapshot data */];
    const BAKED_AT = "2026-03-21T15:00:00Z";
    const REVIEW_COUNT = 0;

    // Viz logic: D3 force simulation, focus+context, tag filtering,
    // timeline scrubber, side panel, URL hash state, pan/zoom/drag
  </script>
</body>
</html>
```

**Checking**: The stale banner. Sync injects it into the existing HTML file. This means sync needs to parse/modify HTML — find a specific element and set its display or inject content.

Simplest approach: the HTML always has a `<div id="stale-banner" style="display:none">Run whygraph viz to update.</div>`. Sync changes `display:none` to `display:block`. `whygraph viz` rebakes the entire file (banner is `display:none` in fresh bake).

Sync modifying HTML: read file → string replace `display:none` → `display:block` on the banner div → write file. Simple text replacement, not HTML parsing. ✅

---

## Angle 2: Team Workflow Scenarios

### Scenario: Two developers, same branch

Dev A runs `/whygraph-scan` and populates the graph. Commits .whygraph/events.jsonl. Pushes.

Dev B pulls. Has the full graph. Runs `/whygraph-interview` to add decisions. Commits updated events.jsonl. Pushes.

Dev A pulls B's changes. events.jsonl has B's new events appended. Everything works. ✅

### Scenario: Merge conflict in events.jsonl

Dev A and Dev B both work on separate branches. Both append events to events.jsonl. Both push. Merge conflict.

events.jsonl is append-only. A merge conflict means both branches appended different events after the same base. The resolution is simple: keep all events from both branches, in order (base events, then A's events, then B's events — or vice versa).

Git's default merge for text files would show a conflict. But since both sides are pure appends after the same base, `git merge` with the default strategy should auto-resolve by concatenating both sides' additions.

Actually — git's merge strategy for text files may not auto-resolve appends cleanly if both sides added lines at the same position (end of file). It depends on whether both branches end with a newline.

**This is a known JSONL merge pattern.** The standard advice: ensure every line ends with `\n` (including the last line). Git's merge driver can handle append-append conflicts if the last line has a trailing newline.

Not an ambiguity — implementation detail. Ensure `fs.appendFile` always appends `line + '\n'`. ✅

### Scenario: Developer without whygraph installed

A team member who hasn't installed whygraph pulls the repo. `.whygraph/events.jsonl` exists in the repo. They can read the raw JSONL if they want. They can open `viz/index.html` in a browser (if committed). They just can't run whygraph commands.

No issue — whygraph degrades gracefully to a committed data file + static HTML. ✅

### Scenario: Moving between branches with different graph states

Dev is on `main` with a full graph. Switches to `feature-branch` which was created before whygraph was initialized. `.whygraph/` doesn't exist on this branch.

MCP server returns "not initialized" on every call. Agent gets the message, informs user. User can either init on this branch or merge main into it.

When they merge main (which has .whygraph/) into the feature branch, they get the full graph. ✅

---

## Angle 3: Viz Bake Process Deep Dive

### Snapshot generation walkthrough

1. Read all events from events.jsonl. ✅
2. Collect all unique timestamps. Sort chronologically. ✅
3. For each unique timestamp: call `buildGraphAt(events, cutoff=timestamp)`. ✅
4. Serialize the resulting graph: iterate all nodes with attributes, all edges with attributes. ✅

**Checking**: `buildGraphAt` replays events with `timestamp <= cutoff`. Events with the exact cutoff timestamp are included. ✅

**Checking**: Snapshot size. Each snapshot is a full graph serialization — not a diff from the previous snapshot. For a graph with 100 nodes and 50 edges, each snapshot is maybe 10-20KB of JSON. 50 snapshots = 500KB-1MB. Plus D3 (~280KB). Total HTML: 1-1.5MB. Reasonable. ✅

**Checking**: What if two events have the exact same timestamp but different event types? For example, a `node_added` and its `edge_added` both at T=14:05:00Z (same staging entry). Both are included in the snapshot at T=14:05:00Z. The node and its edge appear together. ✅

**Checking**: What if events from different staging entries have the same timestamp (two agents wrote at the exact same second)? Both events included in the same snapshot. The snapshot shows both changes simultaneously. Fine — timestamps are second-precision, collisions are possible. ✅

### Stale banner injection

1. Sync finishes appending events.
2. Checks if `viz/index.html` exists.
3. Reads the HTML file.
4. String replaces `id="stale-banner" style="display:none"` → `id="stale-banner" style="display:block"`.
5. Writes the file back.

**Checking**: What if the HTML was manually edited and the banner div doesn't match the expected string? The string replacement fails silently — no match found, file unchanged. The banner doesn't appear. Not great, but not a crash. ✅

**Checking**: What if sync runs twice without a viz rebake between them? First sync: banner injected (none → block). Second sync: tries to replace `display:none` but it's already `display:block`. No match → no change. Banner stays visible. ✅

---

## Angle 4: One More Edge Case Sweep

### Decision with `supersedes` pointing to a decision that AFFECTS different nodes

D1 AFFECTS comp-auth. D2 AFFECTS comp-api. Agent writes D2 with `supersedes: D1-uuid`. D2 supersedes D1 but they affect completely different components.

Is this valid? Yes — a decision might supersede another for architectural reasons even if they affect different parts of the codebase. For example, "use microservices" might supersede "use monolith" — both decisions affect different components but one replaces the other architecturally.

Whygraph records it. The viz shows a SUPERSEDES edge between two diamonds in different parts of the graph. The developer sees it and understands the relationship. ✅

### `[ref-update]` targeting the App node

Agent writes `[ref-update] <app-uuid>` to add a ref to the App node. Valid? The App node has optional refs. Adding a directory ref like `{ file: "src/" }` is technically valid but semantically questionable (the root directory ref isn't useful for `whygraph_context` matching).

No validation prevents it. Mirror principle. ✅

### `[node-removed]` targeting a Decision node directly

Agent explicitly removes a decision (not via cascade from a structural node removal). Writes `[node-removed] <decision-uuid>`.

Process-staging: removes the decision node and its edges (AFFECTS, SUPERSEDES). No COMPOSES descendants (decisions don't have children). No cascade needed.

But: if this decision had superseded another (D2 superseded D1), removing D2 removes the SUPERSEDES edge. D1's status is still "superseded" (from the `node_patched` event when D2 was created). D1 is now superseded by a decision that no longer exists.

Should removing D2 revert D1's status to "active"? That would require process-staging to detect the orphaned supersede state and emit a `node_patched` to restore D1.

Or: mirror principle — D1 stays superseded. The developer sees D1 is superseded but the superseding decision is gone. They can address it.

Consistent with our approach. **Mirror principle. D1 stays superseded.** If it should be reverted, the developer or agent stages a `[node-patched]` to set D1 back to active.

Wait — there's no `[node-patched]` staging entry type. The only way to patch a node's properties is through `[ref-update]` (for refs), `[deprecate]` (for status), or `[resolve-review]` (for supersede status).

⚠️ AMBIGUITY: There's no general-purpose staging entry type for patching arbitrary node properties. The current types handle specific cases:
- `[ref-update]` patches refs
- `[deprecate]` patches status to deprecated
- `[resolve-review]` patches status to superseded

But there's no way to: revert a decision's status to active, update a feature's description, change a component's name, etc.

Options:
- Add a general `[patch] <uuid>` entry type that can set any property
- Accept the limitation — these scenarios are rare enough that manual events.jsonl editing (or a future CLI command) can handle them
- The agent can stage the correction indirectly (e.g., create a new decision that replaces the orphaned state)

---

## Summary

### Pass 11 Ambiguities Found

1. **No general-purpose node patch staging entry** — can't revert statuses, update names/descriptions, or fix arbitrary properties through staging. Only specific patch types exist (ref-update, deprecate, resolve-review).

### Observations

- All file formats serialize cleanly
- Team workflows (merge, branch, non-users) work
- Viz bake process is complete and handles edge cases
- Stale banner injection is simple string replacement
- Cross-feature supersede relationships are valid
- Direct decision removal leaves orphaned supersede states (mirror principle)

**One ambiguity. It's a gap in staging expressiveness.**
