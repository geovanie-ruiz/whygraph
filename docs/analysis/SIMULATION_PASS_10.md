# Whygraph — Simulation Pass 10

Tenth simulation. Attempting to find any remaining gaps by: systematically verifying every resolved ambiguity still holds under the full design, checking for emergent contradictions from the cumulative resolutions, and walking through the user's first 30 minutes with whygraph.

---

## Angle 1: Resolved Ambiguity Regression Check

Verifying that solutions from earlier passes weren't broken by later changes.

### Pass 1-2 Resolutions

| Resolution | Still valid? |
|-----------|-------------|
| Init two-phase (CLI + agent scan) | ✅ No conflicts |
| Config: init uses prompts, config uses flags | ✅ |
| Config schema (5 fields, no App UUID) | ✅ |
| Multiline staging values | ✅ Parser handles it |
| UUIDs only in staging refs | ✅ |
| errors.jsonl for failed entries | ✅ Cleared each sync |
| reviews.jsonl with UUID IDs | ✅ |
| Lock file for sync | ✅ Upgraded to advisory locks |
| Atomic append with dedup | ✅ |
| Forward-compatible schema parsing | ✅ |
| Local dev dependency distribution | ✅ |
| MCP as `whygraph mcp` subcommand | ✅ |

### Pass 3-4 Resolutions

| Resolution | Still valid? |
|-----------|-------------|
| `parent: app` reserved keyword | ✅ |
| Aliases in `[deprecate]` | ✅ |
| Auto-generated events share parent timestamp | ✅ |
| One-click focus shift | ✅ |
| Focus auto-clears on invisible | ✅ |
| Recursive node removal | ✅ Enhanced with affects patching and decision cleanup |
| errors.jsonl cleared each sync | ✅ |
| Dedup check for crash recovery | ✅ |
| `files-touched` + `affects` dual support | ✅ |
| Global processing order across staging files | ✅ |
| Exact file match for whygraph_context | ✅ |
| Tag filter overlay message | ✅ |
| Review entry UUIDs | ✅ |
| DEPRECATES new→old direction | ✅ |
| Silent no-op for missing ref removal | ✅ |

### Pass 5-7 Resolutions

| Resolution | Still valid? |
|-----------|-------------|
| .gitignore in .whygraph/ | ✅ |
| Git hook conflict detection | ✅ |
| affects property kept in sync via node_patched | ✅ |
| Separate .sessions-lock | ✅ |
| No supersede target validation | ✅ Mirror principle |
| No cycle validation | ✅ Mirror principle |
| 7 agent instructions | ✅ |
| Tags in URL hash | ✅ |
| Deprecated node side panel | ✅ |
| Decisions removed when losing all AFFECTS | ✅ |
| Skip-and-warn for invalid projection events | ✅ |
| Presentational date field | ✅ |
| Node removal event ordering (patch → edge → node) | ✅ |
| Auto-dismiss reviews on node removal | ✅ |
| Interview timeline = recording time | ✅ |

### Pass 8-9 Resolutions

| Resolution | Still valid? |
|-----------|-------------|
| sessions.json parse failure → treat as empty | ✅ |
| Advisory file locking (proper-lockfile) | ✅ |
| Empty fields → placeholder text | ✅ |
| D3 as npm dependency, read at bake | ✅ |
| MCP without init → start, return errors | ✅ |

**All 50+ resolutions hold. No regressions.**

---

## Angle 2: Emergent Contradictions Check

Looking for pairs of resolutions that might conflict when combined.

### Advisory locking + sessions lock

Sync acquires `.lock` (advisory). Session registration acquires `.sessions-lock` (advisory). These are independent locks. Could there be a deadlock?

Sync reads sessions.json (needs .sessions-lock? No — sync only reads sessions.json, it doesn't write to it. Only session registration/deregistration writes to sessions.json).

Wait — `whygraph sync --flush` clears sessions.json. That's a write. Does it need .sessions-lock?

Sync step 1: check sessions.json. If --flush, clear it. This is a read-then-write. Should sync acquire .sessions-lock before reading sessions.json?

If sync reads sessions.json without the lock, and an agent deregisters simultaneously (holding .sessions-lock), sync could read stale data. But sync's read is a point-in-time check — if it reads before the deregister, it sees the session and skips (or prompts). If it reads after, it sees empty and proceeds. Both are valid outcomes.

For `--flush`: sync writes `{"active":[]}` to sessions.json. If an agent is registering at the same time (holding .sessions-lock), the agent writes first, sync overwrites with empty. The agent's registration is lost. But --flush is explicitly "clear all sessions" — losing a registration is the intended behavior.

No deadlock. No conflict. ✅

### Global processing order + capture timestamps

Entries are processed globally by type (features first, decisions last). But each entry has its own capture timestamp. The emitted events use the capture timestamp, not the processing order.

Could this cause a temporal inversion? Feature created at T=14:10, decision created at T=14:05 (agent wrote the decision first, then realized it needed a new component). Processing order: feature first (T=14:10), then decision (T=14:05). In events.jsonl, the feature event has T=14:10, the decision event has T=14:05. But the decision references the feature via files-touched resolution.

In events.jsonl, the decision event (T=14:05) appears AFTER the feature event (T=14:10) — because events are serialized in processing order, not timestamp order. But the decision's timestamp is earlier.

When `buildGraphAt` replays to T=14:07 (between the two timestamps), it would include the decision (T=14:05) but NOT the feature (T=14:10). The decision references a node that doesn't exist yet at T=14:07.

⚠️ AMBIGUITY: Temporal inversion when processing order differs from capture timestamp order. A decision processed after a feature (due to type priority) but timestamped before the feature creates an impossible graph state at intermediate timestamps.

Options:
- Force capture timestamps to respect processing order (not realistic — the agent writes entries in whatever order)
- buildGraphAt uses file position order, not timestamp order (breaks the "snapshot per unique timestamp" model)
- Assign the same timestamp to all entries in a batch (lose granularity but maintain consistency)
- Accept it — at any snapshot, skip events whose dependencies don't exist yet (defensive projection)

---

## Angle 3: First 30 Minutes User Walkthrough

Simulating a real user's experience minute by minute.

**Minute 0**: User has a Node.js project. Installs whygraph: `npm install --save-dev whygraph`. ✅

**Minute 1**: Runs `npx whygraph init`. Guided prompts. Accepts all defaults (Claude Code, hook, always inject, supervised). Names the app "MyProject". ✅

**Minute 2**: Init creates .whygraph/, writes App event, generates Claude Code skill + MCP config + hook, bakes viz (lone App node), opens browser. User sees a single dark circle labeled "MyProject". ✅

**Minute 3**: User reads the printed instructions: "Run /whygraph-scan in your agent." Opens Claude Code. Types `/whygraph-scan`. ✅

**Minute 4-8**: Agent reads the codebase. Proposes:
```
Found 4 features and 15 components:
- Authentication (src/auth/)
  - OAuth Provider
  - Session Manager
  - Password Hasher
- API (src/api/)
  - Router
  - Middleware
  - Error Handler
  ...
```
User reviews and confirms. Agent writes staging file with all entries. ✅

**Minute 9**: Agent finishes turn. Deregisters. Hook fires sync. Sync processes 19 entries (4 features + 15 components). Events appended. Stale banner injected into viz. ✅

**Minute 10**: Agent offers `/whygraph-interview`. User says "sure, let's do 5 minutes." Agent calls `get_gaps(10)`. ✅

**Checking**: MCP pre-check at this point. Staging is empty (just synced). Sessions has the current session (agent just registered for interview). MCP sees staging empty → serves normally. ✅

**Minute 10-15**: Agent walks through gaps. User explains 3 decisions. Agent writes staging entries with `affects:` UUIDs. ✅

**Minute 15**: User says "that's enough for now." Agent deregisters. Hook fires sync. 3 decisions processed. ✅

**Minute 16**: User runs `npx whygraph viz`. Staging empty → proceeds. Bakes HTML with snapshots: snapshot 1 (App node, init time), snapshot 2 (full tree, scan time), snapshots 3-5 (one per interview decision). Opens browser. ✅

**Minute 17**: User sees the full graph. Features as rounded rectangles. Components as circles. 3 decisions as diamonds. Scrubs timeline — watches the graph grow from App → full tree → decisions appearing. ✅

**Minute 18**: User clicks Authentication feature. Subtree spreads. Sees the OAuth Provider component, the Session Manager, and one decision diamond. Side panel shows feature details. ✅

**Minute 20**: User starts actual development. Opens Claude Code, asks agent to add rate limiting to the API. Agent registers session. Calls `whygraph_context(file: "src/api/middleware/index.ts")`. Gets Middleware component, its parent (API feature), and any decisions affecting it. ✅

**Minute 20-25**: Agent implements rate limiting. Creates `src/api/middleware/rate-limiter.ts`. Writes staging:
- `[component]` for Rate Limiter (parent: Middleware UUID)
- `[decision]` about token bucket algorithm (files-touched: src/api/middleware/rate-limiter.ts)
✅

**Minute 25**: Agent finishes. Deregisters. Hook fires sync. New component + decision processed. Stale banner injected. ✅

**Minute 26**: User hits F5 on the viz tab. Sees stale banner: "Run whygraph viz to update." Runs `npx whygraph viz`. Rebakes. F5 again. Fresh graph with the new Rate Limiter component and decision. ✅

**Complete 30-minute walkthrough. No gaps.**

---

## Summary

### Pass 10 Ambiguities Found

1. **Temporal inversion in snapshots** — entries processed by type priority may have capture timestamps that don't respect processing order, creating impossible intermediate graph states.

### Observations

- All 50+ prior resolutions verified — no regressions
- No emergent contradictions from combined resolutions
- First 30 minutes user experience is smooth and complete
- Advisory locking + session locking: no deadlock risk

**One ambiguity. It's a genuine issue in the snapshot/timeline model.**
