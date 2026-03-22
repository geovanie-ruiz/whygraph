# Whygraph — Simulation Pass 7

Seventh simulation. Approaching from: user mental model consistency, adversarial/unexpected inputs, the full lifecycle of a single decision from birth to death, and any remaining cross-reference inconsistencies in the design document itself.

---

## Angle 1: Full Decision Lifecycle (Birth to Death)

Tracing a single decision through every possible state transition.

### Birth (Normal Work)

1. Agent edits `src/auth/session.ts`. Calls `whygraph_context(file: "src/auth/session.ts")`. Gets comp-session UUID and existing decisions. ✅
2. Agent decides to use JWT over session cookies. Writes staging:
```markdown
## [decision] Use JWT over session cookies
timestamp: 2026-03-21T14:10:00Z
context: ...
decision: ...
tradeoffs: ...
alternatives: ...
files-touched: src/auth/session.ts
tags: security
```
3. Sync processes: assigns UUID `D1`. Resolves `src/auth/session.ts` → comp-session. Emits `node_added` (D1, status: active) + `edge_added` (AFFECTS, D1 → comp-session). ✅
4. Supersede check: existing decision AUTH-OLD also AFFECTS comp-session → writes review to `reviews.jsonl`. ✅
5. Viz shows D1 as active diamond near comp-session. ✅

### Review Resolution

6. Agent calls `whygraph_get_reviews()`. Gets review `rev-001` suggesting D1 may supersede AUTH-OLD. ✅
7. User confirms. Agent writes `[resolve-review] rev-001` with `action: supersede`. ✅
8. Sync processes: emits `node_patched` (AUTH-OLD status: superseded) + `edge_added` (SUPERSEDES, D1 → AUTH-OLD). Removes review. ✅
9. Viz shows D1 active, AUTH-OLD as superseded (dashed diamond, no fill). SUPERSEDES edge visible. ✅

### Superseded (by a newer decision)

10. Later, agent decides to switch from JWT to OAuth tokens. Writes staging with `supersedes: D1-uuid`. ✅
11. Sync: creates D2, emits SUPERSEDES D2 → D1, patches D1 status: superseded. ✅
12. Viz: D2 active, D1 superseded, AUTH-OLD superseded. Chain visible: D2 → D1 → AUTH-OLD. ✅

### Node Removal (Affected component deleted)

13. Later, comp-session is deleted. Agent writes `[node-removed] <comp-session-uuid>`. ✅
14. Sync cascade:
    - (a) `node_patched` on D2: `affects` updated to remove comp-session UUID. D2 had only one AFFECTS edge → affects becomes `[]`. ✅
    - (b) `edge_removed` for AFFECTS D2 → comp-session. ✅
    - (c) D2 has zero AFFECTS edges → `node_removed` for D2. ✅
    - (d) But D1 was superseded by D2. D2 is being removed. Does D1's SUPERSEDES edge (D2 → D1) get removed? Yes — step (b) removes ALL edges connected to D2, including SUPERSEDES. ✅
    - (e) D1 also AFFECTS comp-session. Same cascade: edge removed, affects patched, D1 loses all AFFECTS → D1 removed. ✅
    - (f) AUTH-OLD: same cascade through D1's removal. SUPERSEDES edge from D1 → AUTH-OLD is removed. AUTH-OLD also AFFECTS comp-session → edge removed → affects empty → AUTH-OLD removed. ✅
    - (g) `node_removed` for comp-session itself. ✅
15. All three decisions and the component are gone from the graph after this timestamp. ✅
16. Timeline scrubbing back shows the full history: comp-session and all decisions visible at earlier timestamps. ✅

**Full lifecycle traces cleanly. No gaps.**

---

## Angle 2: Birth (Interview)

1. Agent calls `whygraph_get_gaps(10)`. Gets comp-oauth (UUID: abc-123). ✅
2. User explains: "We chose Google OAuth because..." ✅
3. Agent writes:
```markdown
## [decision] Google OAuth over Auth0
timestamp: 2026-03-21T10:15:00Z
date: September 2025
context: ...
decision: ...
tradeoffs: ...
alternatives: ...
affects: abc-123
tags: security, integration
```
4. Sync: assigns UUID. Uses `affects` directly (no file resolution needed). Emits events. `date` stored as "September 2025". Timestamp used for snapshot ordering. ✅
5. Viz: decision shows "September 2025" in side panel. In timeline, it appears at the 2026-03-21T10:15:00Z position (when it was recorded, not when it was made).

**Wait.** The timeline shows the decision appearing at the recording time, not at the actual decision time. For a historical decision made in September 2025, the timeline shows it popping in during March 2026. That misrepresents when the decision was actually made.

⚠️ AMBIGUITY: Interview decisions appear in the timeline at their recording timestamp, not their actual decision date. The presentational `date` says "September 2025" but the timeline places it at March 2026 (when the interview happened). This is misleading — the user sees a decision appear months after the structural nodes it describes.

Options:
- Use the presentational `date` for timeline placement (but it's freeform — "September 2025" isn't parseable as a precise timestamp)
- Add an optional `event-date:` field (ISO timestamp) for historical decisions — used for timeline placement. `date:` remains presentational.
- Accept the limitation — interview decisions appear at recording time. The `date` field in the side panel shows the actual date.
- Place interview decisions at the timestamp of the node they affect (they appear alongside the structural nodes they describe)

---

## Angle 3: User Mental Model

### What the user expects vs what they see

User runs `/whygraph-scan` which populates features and components. All created at roughly the same timestamp. One snapshot.

User then runs `/whygraph-interview` and records 10 historical decisions over the next hour. Each decision gets a different capture timestamp.

The timeline now shows:
- Position 1: Full structural tree appears (scan timestamp)
- Positions 2-11: Decisions appear one by one (interview timestamps)

The user scrubs the timeline and sees: the app's structure appearing all at once, then decisions popping in one by one over the next hour. This accurately represents the *recording* sequence but not the *historical* sequence.

The user might expect: the timeline shows the app being built over time, with decisions appearing at the time they were actually made. But whygraph can't know when the decisions were actually made with precision — only the freeform `date` field hints at it.

This is a fundamental limitation of retroactive population. The timeline is based on event timestamps, which reflect recording order, not historical order. The `date` field provides historical context in the side panel.

Is this acceptable? Or does the timeline need to accommodate historical dates?

---

## Angle 4: Document Cross-Reference Check

Scanning for internal inconsistencies in DESIGN_DECISIONS.md.

1. **Line 61**: Decision properties list includes `affects`. Earlier we established that `affects` is kept in sync via `node_patched` during cascades. The property definition is correct — it's an array of UUIDs. ✅

2. **Line 624**: "No file watcher option — file watchers have a race condition where they can read `staging.md`..." — should say `staging/` not `staging.md`. This is a stale reference.

3. **Line 700**: Changelog says "Staging file per session, `files-touched` instead of `affects` UUIDs" — this is partially outdated. We now support both `files-touched` and `affects`. Should say "Staging file per session, `files-touched` (primary) and `affects` (for interviews)".

4. **Line 702**: "Affects resolution: `process-staging` resolves file paths to nodes via refs" — should mention that `affects` UUIDs are also accepted (used directly, no resolution).

---

## Angle 5: Adversarial/Unexpected Inputs

### Agent writes to wrong staging file

Agent A with session-aaa writes to `staging/session-bbb.md` (session B's file). When both agents deregister and sync runs, the entries are processed normally — sync reads all files regardless of naming convention.

No security issue (all agents can write to the staging directory). The session naming is a convention, not an enforcement. Aliases in session-bbb.md that were intended for session-aaa.md won't resolve (file-scoped). This would cause validation errors for those entries.

Not a design gap — the agent skill generates the correct filename. Misbehavior results in validation errors, not data corruption. ✅

### User manually edits events.jsonl

User adds a malformed line or modifies an existing event. `loadEvents()` skips malformed lines. Modified events change the graph state — but the user did this intentionally. Whygraph is a mirror.

If the user breaks the schema (invalid node label, missing properties), `buildGraph` skips and warns (defensive projection). ✅

### Very long decision text

Agent writes a 5000-word context field. The staging parser handles it (multiline, no length limit). The event stores it. The viz side panel renders it in a collapsible section. The HTML file gets larger.

No issue at reasonable scale. ✅

### Unicode in names and descriptions

Agent names a feature "認証" (Japanese for "authentication"). UUIDs are ASCII. Names can be any string. The staging parser handles Unicode. The viz renders it. No issue. ✅

### Empty events.jsonl

`loadEvents()` on an empty file returns `[]`. `buildGraph([])` returns an empty graph. MCP tools return empty results. `whygraph viz` bakes an empty viz (just the HTML shell, no nodes). This would happen if someone deletes the App node event.

Should `loadEvents()` validate that the first event is an App `node_added`? If not, the graph has no root. Features with `parent: app` in staging would fail.

This is a corruption case — not worth preventing in normal flow. If someone manually empties events.jsonl, they can re-run `whygraph init` (idempotent path would detect missing App and recreate). ✅

---

## Summary

### Pass 7 Ambiguities Found

1. **Interview decisions timeline placement** — recording timestamp vs actual decision date. Historical decisions appear at recording time, not when they were actually made.

### Consistency Issues

1. Line 624: `staging.md` → `staging/`
2. Line 700: changelog should mention both `files-touched` and `affects`
3. Line 702: affects resolution should mention direct UUID acceptance

**One ambiguity. Three minor consistency issues. Approaching convergence.**
