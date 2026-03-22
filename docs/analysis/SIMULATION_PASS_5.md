# Whygraph — Simulation Pass 5

Fifth simulation. Approaching from new angles: repository/git concerns, TypeScript interface consistency, tech stack gaps, data integrity, and untested edge cases.

---

## Angle 1: Repository and Git Concerns

### What gets committed?

The `.whygraph/` directory is in the repo. Which files should be committed and which should be gitignored?

| File | Commit? | Reason |
|------|---------|--------|
| `events.jsonl` | Yes | Source of truth, shared across team |
| `config.json` | Yes | Shared preferences |
| `staging/` | No | Transient buffer, session-specific |
| `sessions.json` | No | Local runtime state |
| `reviews.jsonl` | Yes | Pending reviews are shared state the team needs to see |
| `errors.jsonl` | No | Ephemeral, cleared each sync |
| `.lock` | No | Runtime artifact |
| `viz/index.html` | Maybe | Large file (~300KB+), but useful for GH Pages or sharing |

⚠️ AMBIGUITY: Should whygraph init create a `.whygraph/.gitignore`? The design doesn't mention gitignore at all. Without it, staging files, sessions, errors, and lock files would be committed.

### Git hooks and existing hooks

Init installs a `post-commit` git hook. But the user might already have a post-commit hook (from husky, lint-staged, etc.).

⚠️ AMBIGUITY: How does init handle existing git hooks? Overwrite (destructive)? Append to existing hook? Use a hook manager? This is a common problem — many tools need git hooks.

---

## Angle 2: TypeScript Interface vs Actual Data Flow

### DecisionProperties.affects mismatch

The `DecisionProperties` interface (line 109-120) has:
```typescript
affects: string[];  // Node UUIDs this decision touches
```

But in the staging format, decisions use `files-touched` (file paths) or `affects` (UUIDs). `process-staging` resolves `files-touched` to UUIDs. The resulting `node_added` event for the decision stores the resolved UUIDs in `affects`.

So the event stored in `events.jsonl` has `affects: [uuid1, uuid2]` — the resolved UUIDs, not the file paths. This is correct. The TypeScript interface matches what's in events.jsonl. ✅

But wait — the `affects` property in the event is redundant with the AFFECTS edges. The decision has `affects: [uuid1, uuid2]` as a property AND separate `edge_added` events creating AFFECTS edges to those UUIDs. Two representations of the same relationship.

This is fine for the event log (the property is a convenience for reading the raw event), but in the graph projection, should the `affects` property be stored on the decision node, or should it only exist as edges?

If stored on the node: `graph.getNodeAttribute(decisionId, "affects")` returns `[uuid1, uuid2]`. Matches the edge structure. Slight redundancy.

If not stored: the graph only has edges. To find what a decision affects, traverse outgoing AFFECTS edges. More graph-native.

The current design stores it on the node (the TypeScript interface includes it). This works but the source of truth for the relationship is the edges, not the property. If an AFFECTS edge is later removed (node deletion cascade), the property still lists the old UUID.

We resolved this in pass 4 — the viz reads current snapshot edges, not the property. The MCP tools should do the same — return the current AFFECTS edges, not the stale property.

⚠️ AMBIGUITY: Should MCP tools return `affects` from the node property (possibly stale) or from current AFFECTS edges (always current)? The edges are the truth. The property is historical.

### NodeProperties.status

Features and Components have `status: "active" | "deprecated"`. But the `NodeProperties` interface only has `name` and `description`. Status is set via `node_patched` when a DEPRECATES edge is created.

Where does `status` live in the TypeScript types? It's not in `NodeProperties`. It would need to be:

```typescript
interface StructuralNodeProperties extends NodeProperties {
  status?: "active" | "deprecated";
}
```

Or `status` is just a generic attribute that `node_patched` can set. The projection stores whatever properties the event carries. The TypeScript types in the design doc are conceptual — the actual graph stores whatever attributes are patched in.

This is an implementation detail, not a design gap. `node_patched` can set arbitrary properties. ✅

---

## Angle 3: Tech Stack Consistency

### graphology-shortest-path

The tech stack in the original spec lists `graphology-shortest-path`. The design doc's tech stack (line 678) only lists `graphology` + `graphology-traversal`.

Is `graphology-shortest-path` still needed? The original spec used it for `getHistory` which traversed SUPERSEDES chains. That tool is now absorbed into `whygraph_context`. The SUPERSEDES chain traversal just follows edges — BFS from `graphology-traversal` handles this.

`graphology-shortest-path` can be dropped. ✅ (Not an ambiguity — just confirming the tech stack is correct.)

### prompts usage scope

The tech stack says `prompts` is for "init guided flow only." But we also resolved that sync uses `prompts` for manual review resolution. The scope description should say "init and sync review resolution."

Minor consistency issue. Not an ambiguity.

---

## Angle 4: Data Integrity Scenarios

### Concurrent sessions.json writes

Two agents register simultaneously. Both read sessions.json, both append their session, both write. Last writer wins — one session is lost.

sessions.json is a JSON file, not JSONL. Two processes reading it, modifying the `active` array, and writing back can race.

⚠️ AMBIGUITY: sessions.json concurrent write safety. Options:
- Use the `.lock` file for session registration too (not just sync)
- Use JSONL for sessions (one line per registration/deregistration event) — append-only, no races
- Accept the risk (rare, and the lost session just means sync runs sooner than expected)

### events.jsonl growing very large

At expected scale (hundreds of events), fine. But what if a project runs for years with aggressive decision capture? Thousands of events.

`loadEvents()` reads the entire file. `buildGraph()` replays all events. This scales linearly. At 10,000 events, still probably under 100ms. At 100,000... maybe a concern.

The design says "forward-compatible parsing, no version field, add snapshot caching only when measured." This is consistent. Not an ambiguity — just noting the design explicitly chose to defer scaling.

### Viz HTML file size with many snapshots

Each snapshot is a full graph serialization. 500 unique timestamps × 200 nodes × 50 edges per snapshot = a lot of JSON. The HTML file could grow to several MB.

D3 inlined (~280KB) + snapshot data (potentially several MB) = multi-MB HTML file. Still opens fine in a browser, but it's a large file to commit to git.

Not an ambiguity — the design accepts this tradeoff. At truly large scales, snapshot compression or incremental encoding could be added later. ✅

---

## Angle 5: Untested Edge Cases

### Decision supersedes a decision that's already superseded

Agent writes a decision with `supersedes: <uuid-old>`. But `uuid-old` was already superseded by another decision.

`process-staging` validates that `uuid-old` exists and is a Decision. But should it also check that it's status: "active"? Superseding an already-superseded decision creates a branching chain:

```
D1 ← superseded by D2
D1 ← superseded by D3
```

D1 has two SUPERSEDES edges pointing to it. D2 and D3 both claim to replace D1. This is structurally valid in graphology but semantically weird.

⚠️ AMBIGUITY: Should `process-staging` reject superseding an already-superseded decision? Or is branching supersede chains valid?

### Deprecation cycle

Agent stages `[deprecate] A B` and then later `[deprecate] B A`. A is deprecated by B, then B is deprecated by A. Circular deprecation.

Should `process-staging` detect and reject cycles? Or is this valid (unlikely but not impossible if the project reverses a migration)?

⚠️ AMBIGUITY: Should deprecation and supersede cycles be validated against?

### Feature with no components

A feature has no child components. It just has refs pointing to a directory. Is this valid? The agent might create a feature during scan but not drill into components.

Structurally valid — a feature can exist with just an COMPOSES edge from App and no children. Decisions can AFFECT it directly. `whygraph_context` would match files under its directory ref. ✅

### Component with no refs

A component exists in the graph but has no refs (empty `refs` array or `refs` not set). `whygraph_context` can never resolve a file to this component. It's invisible to the agent's normal workflow.

`whygraph_get_gaps` would return it if it has no decisions. The interview could add decisions to it. But the agent would need `affects: <uuid>` to reference it, not `files-touched`.

This is valid — a component might represent an architectural concept (like "middleware layer") rather than specific files. Not a gap. ✅

### Empty staging file

Agent registers, does no work, deregisters. Hook fires sync. Sync reads `staging/session-abc.md` — file exists but is empty.

Parser finds no entries. Nothing to process. File is deleted. ✅

### Staging file with only invalid entries

All entries fail validation. All go to errors.jsonl. Staging file deleted. No events appended. No stale banner injected (nothing changed in events.jsonl). ✅

---

## Angle 6: Skill/Prompt Completeness

The agent instructions list 5 behaviors. Let me check if they cover all staging entry types:

| Entry type | Which instruction covers it? |
|---|---|
| `[decision]` | "Capture decisions" ✅ |
| `[component]` | "Update refs" partially — but creating a new component is different from updating refs. Missing: "When you create new modules or significant code units, stage a new component." |
| `[feature]` | Not covered. Features are created during `/whygraph-scan`, not during normal work. But what if the agent builds a genuinely new feature area? |
| `[ref-update]` | "Update refs" ✅ |
| `[deprecate]` | "Detect deprecations" ✅ |
| `[resolve-review]` | "Respect staleness" partially — but resolving reviews is a separate behavior. The autonomy config handles this (full autonomy auto-resolves). |
| `[node-removed]` | Not covered. When should the agent stage a node removal? When it deletes an entire module? |

⚠️ AMBIGUITY: Agent instructions are incomplete. Missing behaviors:
- Creating new components during normal work (not just scan)
- Creating new features during normal work
- Staging node removals when code is deleted

---

## Summary

### Pass 5 Ambiguities Found

1. **`.gitignore` for `.whygraph/`** — which files to commit, which to ignore
2. **Git hook conflicts** — init may overwrite existing post-commit hooks
3. **MCP `affects` source** — should return current AFFECTS edges, not stale node property
4. **sessions.json concurrent writes** — JSON read-modify-write race condition
5. **Superseding already-superseded decisions** — branching chains valid or rejected?
6. **Deprecation/supersede cycles** — should be validated against?
7. **Agent instructions incomplete** — missing behaviors for new components/features during work, and node removals

### Consistency Issues

1. Tech stack: `prompts` scope should mention sync review resolution, not just init
2. Supersede workflow "With Agent" section (line 658) still says "entry stays in staging with error marker" — should say "entry goes to errors.jsonl"
