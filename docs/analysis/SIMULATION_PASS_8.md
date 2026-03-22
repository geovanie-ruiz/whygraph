# Whygraph — Simulation Pass 8

Eighth simulation. Angles: state machine for every .whygraph/ file, complete skill/command inventory, handoff sequences, and exhaustive edge case sweep.

---

## Angle 1: State Machine for Every `.whygraph/` File

For each file, tracing every state it can be in and every transition.

### events.jsonl

| State | How it gets here | What reads it | Transitions to |
|-------|-----------------|---------------|----------------|
| Empty (just created) | `whygraph init` creates it | — | Has App node |
| Has App node only | Init writes App event | MCP, viz bake | Has App + structure (after scan sync) |
| Has App + structure | Scan sync appends features/components | MCP, viz bake | Has App + structure + decisions (after work sync) |
| Growing | Each sync appends events | MCP, viz bake | Continues growing |
| Malformed last line | Crash during sync append | `loadEvents()` skips it | Grows past it on next successful sync |

**Checking**: Can events.jsonl ever shrink or be truncated? No — append-only. Even malformed lines stay. The only destructive path is manual user intervention. ✅

### config.json

| State | How it gets here | What reads it | Transitions to |
|-------|-----------------|---------------|----------------|
| Created with defaults | `whygraph init` | `whygraph config`, platform file generation, MCP (for autonomy/context injection settings) | Updated by `whygraph config` |
| Updated | `whygraph config --flag value` | Same readers | Updated again |

**Checking**: Does the MCP server read config.json? It needs to know `contextInjection` to decide behavior. But wait — the MCP server doesn't make decisions about context injection. The agent's skill/prompt reads the config (or the skill is generated with the setting baked in). The MCP server just serves data.

Actually, the MCP server doesn't need config.json at all. It reads events.jsonl, staging/, sessions.json, reviews.jsonl, errors.jsonl for its pre-checks. Config is only read by the CLI commands and used during platform file generation.

✅ No issue — just clarifying that MCP doesn't read config.

### staging/ (directory)

| State | How it gets here | What reads it | Transitions to |
|-------|-----------------|---------------|----------------|
| Empty dir | Init creates it | Sync (no-op if empty) | Has session files (agent writes) |
| Has session files | Agent writes during work | Sync reads all files | Empty (sync deletes files) |
| Has files, sessions active | Multi-agent work in progress | MCP (checks for staleness) | Has files, no sessions (all agents done) |
| Has files, no sessions | All agents done or crashed | MCP (rejects), sync (processes) | Empty (after sync) |

**Checking**: What if a staging file is 0 bytes (agent crashed mid-create)? Parser reads empty file, finds no entries, deletes it. ✅

### sessions.json

| State | How it gets here | What reads it | Transitions to |
|-------|-----------------|---------------|----------------|
| `{"active":[]}` | Init creates, or all sessions deregistered | Sync, MCP | Has sessions (agent registers) |
| Has sessions | Agent registered | Sync (skips if hook-triggered), MCP (warns) | Fewer sessions (agent deregisters) |
| Stale sessions | Agent crashed | Sync (prompts), MCP (errors) | Empty (user flushes) |

**Checking**: What if sessions.json is corrupted (e.g., malformed JSON from a race condition even with the sessions lock)? The reader should handle this defensively — if sessions.json can't be parsed, treat it as empty (allow sync to proceed). Otherwise a corrupted sessions file blocks everything.

⚠️ AMBIGUITY: sessions.json parse failure — should it be treated as empty (allow operations) or as an error (block operations)?

### reviews.jsonl

| State | How it gets here | What reads it | Transitions to |
|-------|-----------------|---------------|----------------|
| Empty | Init creates, or all reviews resolved/dismissed/auto-dismissed | MCP (no warning), viz bake (no banner) | Has entries (sync detects supersede candidates) |
| Has entries | Sync writes potential supersede candidates | MCP (warns), viz bake (banner), `whygraph_get_reviews()`, sync (offers resolution) | Fewer entries (review resolved or auto-dismissed during node removal) |

**Checking**: reviews.jsonl is not cleared on sync (unlike errors.jsonl). Reviews persist until explicitly resolved or auto-dismissed. ✅

**Checking**: What if reviews.jsonl grows very large? This would require many decisions affecting the same nodes without any review resolution. Unlikely in practice — the MCP warning and sync prompting should drive resolution. Not a design gap. ✅

### errors.jsonl

| State | How it gets here | What reads it | Transitions to |
|-------|-----------------|---------------|----------------|
| Empty | Init creates, or sync clears it at start | MCP (no warning) | Has entries (sync writes validation failures) |
| Has entries | Sync wrote invalid entry details | MCP (warns), `whygraph_get_errors()` | Empty (next sync clears it) |

✅ Clean lifecycle.

### .lock

| State | How it gets here | What reads it | Transitions to |
|-------|-----------------|---------------|----------------|
| Doesn't exist | Normal state | Sync checks | Exists (sync acquires) |
| Exists | Sync acquired it | Other sync attempts (block/exit) | Doesn't exist (sync releases) |
| Exists (stale) | Sync crashed while holding lock | Other sync attempts (block forever) | — |

⚠️ AMBIGUITY: Stale .lock file. If sync crashes while holding the lock, the lock file persists. Next sync attempt blocks forever (or exits). No recovery mechanism.

Options:
- Store PID in the lock file. Check if the PID is still running. If not, the lock is stale — acquire it.
- Lock files with a timeout — if the lock is older than N seconds, consider it stale.
- Use advisory file locking (`flock`) which auto-releases on process exit.

`flock` (or Node's equivalent via `proper-lockfile` npm package) is the standard solution. It's automatically released when the process exits, even on crash. No stale lock problem.

### .sessions-lock

Same states and same stale-lock concern as .lock.

Same solution: use `flock`-style advisory locking.

### viz/index.html

| State | How it gets here | What reads it | Transitions to |
|-------|-----------------|---------------|----------------|
| Doesn't exist | Before first viz bake | — | Exists (init bake or `whygraph viz`) |
| Fresh (no banner) | `whygraph viz` just baked | Browser | Stale (sync injects banner) |
| Stale (has banner) | Sync injected banner after appending events | Browser (shows banner) | Fresh (next `whygraph viz` rebakes) |

✅ Clean lifecycle.

### .gitignore

| State | How it gets here | What reads it | Transitions to |
|-------|-----------------|---------------|----------------|
| Created | Init creates | Git | Unchanged (static file) |

✅ Static.

---

## Angle 2: Complete Skill/Command Inventory

### CLI Commands (User-Invoked)

| Command | Invoked by | Requires agent? | Reads | Writes |
|---------|-----------|-----------------|-------|--------|
| `whygraph init` | User in terminal | No | Nothing (or existing config for idempotency) | events.jsonl, config.json, sessions.json, reviews.jsonl, errors.jsonl, staging/, viz/, .gitignore, platform files, hooks, viz/index.html |
| `whygraph sync` | Hook or user | No | sessions.json, staging/, events.jsonl, reviews.jsonl | events.jsonl, reviews.jsonl, errors.jsonl, viz/index.html (banner injection) |
| `whygraph sync --flush` | User | No | Same as sync | Same as sync + clears sessions.json |
| `whygraph viz` | User | No | events.jsonl, reviews.jsonl | viz/index.html |
| `whygraph config --flag value` | User | No | config.json | config.json, platform files |
| `whygraph mcp` | Platform config (spawned as subprocess) | No | events.jsonl, staging/, sessions.json, reviews.jsonl, errors.jsonl | Nothing (read-only) |

### Agent Skills (Agent-Invoked)

| Skill | Invoked by | Requires MCP? | Writes to staging? |
|-------|-----------|---------------|---------------------|
| `/whygraph-scan` | Agent (after init) | No (reads codebase directly) | Yes |
| `/whygraph-interview` | Agent (after scan) | Yes (calls get_gaps) | Yes |

**Checking**: Does `/whygraph-scan` need MCP? The agent scans the codebase (reads files directly) and writes staging entries. It doesn't need to query the graph — there's nothing in it yet (just the App node). But it does need the App node's existence confirmed.

The agent could call `whygraph_context` to verify whygraph is initialized. Or it could just check if `.whygraph/events.jsonl` exists. Either works.

Actually — during scan, the agent needs to register a session. Session registration writes to `sessions.json`. The agent does this via the skill instructions (filesystem write). No MCP needed. ✅

**Checking**: Are there any other skills we've discussed?

- `/whygraph-scan` — codebase analysis ✅
- `/whygraph-interview` — historical decision capture ✅

No others. The normal work flow is driven by the agent's skill instructions (capture decisions, map new code, etc.), not a separate skill invocation. ✅

---

## Angle 3: Handoff Sequences

### Init → Scan → Interview → Normal Work

1. User: `npx whygraph init` → CLI creates everything, prints scan instructions ✅
2. User: pastes `/whygraph-scan` into agent → agent registers session, reads codebase, proposes tree, user confirms, writes staging, deregisters → hook fires sync → graph populated ✅
3. Agent: offers `/whygraph-interview` → agent registers, calls `get_gaps`, walks through with user, writes staging, deregisters → hook fires sync → decisions populated ✅
4. Normal work: agent registers, calls `whygraph_context(file)`, does work, writes staging, deregisters → hook fires sync → graph updated ✅

**Complete handoff chain. No gaps.** ✅

### Multi-Agent Handoff

1. Agent A and B both register ✅
2. Both write to their staging files ✅
3. A finishes → deregisters → hook fires sync → B still active → sync skips ✅
4. B finishes → deregisters → hook fires sync → sessions empty → sync processes both files globally ✅

**Checking**: What if Agent A finishes, hook fires sync (skips), and then Agent A starts a NEW session before Agent B finishes? A registers again. Now sessions has A (new) and B (still going). A writes new staging entries.

When B finishes, sessions still has A (new). Sync skips again. When A (new session) finishes, sessions empty → sync processes everything (A's old file, B's file, A's new file).

Wait — A's old staging file was from the first session (`staging/session-aaa-1.md`). The new session is `staging/session-aaa-2.md` (different session ID). Both files are processed together. ✅

Actually — does the session ID change between turns? A Claude Code hook fires at the end of each turn. The agent registers at the start of each turn. So each turn is a new session?

⚠️ AMBIGUITY: Is a "session" one agent turn (register at start, deregister at end of turn) or a continuous agent session (register once, deregister when the user explicitly ends)? This affects how many staging files accumulate and how session IDs work.

If per-turn: many short sessions, many small staging files. Sync fires after each turn (single agent case) or accumulates across turns (multi-agent).

If continuous: fewer sessions, staging files grow across turns. Sync only fires when the continuous session ends.

The design says: "Agent starts working → registers. Agent finishes turn → deregisters." This is per-turn. Each turn is a session. The hook fires after each turn.

But in single-agent Claude Code: agent registers, does work, turn ends, deregisters, hook fires sync, staging processed. Next turn: agent registers again (new session ID, new staging file). Previous staging file was already processed and deleted.

This works. Each turn is independent. The staging file for a turn is processed at the end of that turn. ✅

For multi-agent: Agent A registers turn 1, Agent B registers turn 1. A finishes turn 1 → deregisters → sync skips (B active). B finishes turn 1 → deregisters → sync processes both files. A starts turn 2 → registers. B starts turn 2 → registers. And so on.

Between A's turn 1 ending and A's turn 2 starting, sync ran and processed A's turn 1 staging. A's turn 2 starts fresh. ✅

But: what if sync hasn't finished processing when A starts turn 2? A registers, sync is still running (holding .lock). A writes to staging. Sync finishes, deletes staging files (including A's turn 1). But A's turn 2 staging file is new (different session ID). No conflict. ✅

---

## Angle 4: Exhaustive Edge Case Sweep

### Decision with no context (empty string)

Agent writes:
```
## [decision] Quick fix for bug
timestamp: ...
context:
decision: Just fixed it
tradeoffs:
alternatives:
files-touched: src/bug.ts
tags: arch
```

All required fields are present but some are empty strings. Is this valid?

The design says: "Never write an incomplete decision" (from the original spec). But the design decisions doc doesn't explicitly require non-empty strings for decision fields.

⚠️ AMBIGUITY: Are empty strings valid for required decision fields (context, tradeoffs, alternatives)? The agent should provide meaningful content, but should the parser enforce it? If it rejects empty strings, quick/trivial decisions become harder to record. If it allows them, quality degrades.

### Two features with the same name

Agent creates `[feature] Authentication` and later another agent creates `[feature] Authentication`. Both get different UUIDs. The viz shows two rounded rectangles both labeled "Authentication."

Names aren't unique — only UUIDs are. This is confusing but valid. The duplicate would show up in the viz and the developer would notice.

Not a design gap — same principle as allowing supersede cycles. Whygraph is a mirror. ✅

### Decision affects a deprecated component

Agent writes a decision with `files-touched` pointing to a file in a deprecated component. The component is deprecated (status: deprecated) but still exists.

`process-staging` resolves the file to the deprecated component. Emits AFFECTS edge. The decision now AFFECTS a deprecated component.

Is this valid? Yes — decisions can be made about deprecated code. The component is still in the codebase; it's just marked for phase-out. The decision might even be about how to handle the deprecation. ✅

### whygraph viz with zero events (empty events.jsonl)

Should never happen (init always writes the App node). But if someone empties the file:

`loadEvents()` returns `[]`. No snapshots to bake. Viz generates an HTML file with `SNAPSHOTS = []`. The viz renders nothing.

Not great UX but not a crash. Idempotent init would detect the missing App node and offer to recreate. ✅

### Agent calls whygraph_context for a file matching a feature's directory ref

Feature `feat-auth` has `refs: [{ file: "src/auth/" }]`. Agent queries `whygraph_context(file: "src/auth/oauth/provider.ts")`.

Exact file path match against refs: `src/auth/oauth/provider.ts` does NOT exactly match `src/auth/`. No match found.

But the file is clearly under the auth feature. The agent gets an error: "File not found in any node's refs."

We resolved this in pass 3: exact match only, no prefix matching. The component (`comp-oauth`) should have a ref for `src/auth/oauth/provider.ts`. If it doesn't, the file is unmapped.

But what about files directly in `src/auth/` (not in a subdirectory)? Like `src/auth/index.ts`. The feature has `refs: [{ file: "src/auth/" }]`. This is a directory ref. `src/auth/index.ts` doesn't exactly match `src/auth/`.

Should directory refs match files within that directory? We said no — exact match only. But this means directory-level refs on features are useless for `whygraph_context` lookups. They're only informational (shown in the side panel).

This is fine — `whygraph_context` is meant to match against component-level refs (specific files + symbols). Feature-level directory refs are for human orientation in the viz, not for agent lookups. The agent queries by the specific file it's editing, which should match a component. ✅

---

## Summary

### Pass 8 Ambiguities Found

1. **sessions.json parse failure** — corrupted JSON should be treated as empty or as error?
2. **Stale lock files** — .lock and .sessions-lock can persist after crash. Need `flock`-style advisory locking.
3. **Empty decision fields** — should empty strings be valid for required fields like context, tradeoffs, alternatives?

### Observations (Not Ambiguities)

- MCP server doesn't read config.json (only CLI and platform files use it)
- Directory refs on features are informational only — `whygraph_context` matches against component-level file refs
- Per-turn sessions work correctly for single and multi-agent cases
- Complete skill inventory: 2 skills (/whygraph-scan, /whygraph-interview) + 7 agent instructions + 5 CLI commands + 5 MCP tools

**Three ambiguities. All minor. Approaching zero.**
