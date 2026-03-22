# Whygraph — Simulation Pass 2

Re-running the simulation against the updated DESIGN_DECISIONS.md. Focusing on critical paths where changes were made, verifying consistency, and checking for new gaps.

---

## Flow 1: Init → Scan → Interview (Full Onboarding)

### 1.1 `npx whygraph init`

1. Guided prompts: environment (claude-code), sync (hook), context injection (always), autonomy (supervised), app name ("MyApp"). ✅
2. Creates `.whygraph/`: events.jsonl, staging/, config.json, sessions.json, reviews.jsonl, errors.jsonl, viz/. ✅
3. Writes App node_added directly to events.jsonl with `crypto.randomUUID()`. ✅
4. Generates platform files (deferred to implementation). ✅
5. Installs hooks. ✅
6. Bakes initial viz (lone App node). ✅
7. Prints: "Run `/whygraph-scan` in your agent." ✅

**No issues.**

### 1.2 `/whygraph-scan`

1. Agent registers session in sessions.json. ✅
2. Agent reads codebase. ✅
3. Agent proposes features/components with refs. ✅
4. User confirms. ✅
5. Agent writes to `staging/session-<id>.md`:

```markdown
## [feature] Authentication
timestamp: 2026-03-21T10:05:00Z
alias: feat-auth
description: User authentication and session management
refs:
  - file: src/auth/

## [component] OAuth Provider
timestamp: 2026-03-21T10:05:01Z
alias: comp-oauth
parent: feat-auth
description: OAuth provider integration
refs:
  - file: src/auth/oauth/provider.ts, symbol: OAuthProvider
  - file: src/auth/oauth/google.ts, symbol: GoogleOAuthProvider
```

`parent: feat-auth` uses an alias. Alias is file-scoped. ✅

6. Agent finishes turn → deregisters → hook fires sync. ✅
7. Sync: sessions empty → acquire lock → read staging → process features first, then components → resolve `feat-auth` alias to UUID → emit events → clear staging → release lock. ✅

**Checking: does `process-staging` need to build the graph to resolve refs?**

For the initial scan, there are no decisions — only structural entries. `files-touched` resolution isn't needed yet. `parent` resolution uses aliases (file-scoped) or UUIDs. The App UUID is read from events.jsonl (first event). ✅

**No issues.**

### 1.3 `/whygraph-interview`

1. Agent registers session. ✅
2. Agent calls `whygraph_get_gaps(10)`.

**Pre-check**: staging empty (scan was synced). sessions.json has one active session (current). MCP sees staging empty → serves normally. ✅

3. Gets back 10 nodes without decisions, ordered hierarchically. ✅
4. Agent walks through them with user. User provides rationale. ✅
5. Agent writes staging entries:

```markdown
## [decision] Google and GitHub as OAuth providers over Auth0
timestamp: 2026-03-21T10:15:00Z
context: ...
decision: ...
tradeoffs: ...
alternatives: ...
files-touched: src/auth/oauth/provider.ts, src/auth/oauth/google.ts
tags: security, integration
```

**Wait.** The decision's `files-touched` lists file paths. `process-staging` needs to resolve these to node UUIDs via refs. But the interview is capturing *historical* decisions — the agent may not have touched any files. The user is explaining why `comp-oauth` was built the way it was.

⚠️ AMBIGUITY: `files-touched` assumes the agent modified files. In the interview flow, the agent didn't modify anything — it's capturing rationale for existing code. The decision needs to AFFECT `comp-oauth`, but the agent doesn't have a `files-touched` list because it didn't touch files.

Options:
- Interview decisions use `affects:` with UUIDs (agent got them from `get_gaps`)
- Interview decisions use `files-touched:` with files that the decision *pertains to* (not files the agent modified)
- New field: `affects-nodes:` for explicit UUID references, `files-touched:` for implicit resolution

The agent got node UUIDs from `get_gaps`. It can use those directly. But we said `files-touched` replaces `affects`. This creates a conflict for the interview flow.

**This is a gap.** The interview flow needs to reference nodes directly, not via files touched.

---

## Flow 2: Normal Agent Work Session

### 2.1 Session Start + Context Query

1. Agent registers session. ✅
2. Agent is about to edit `src/auth/oauth/provider.ts`.
3. Agent calls `whygraph_context(file: "src/auth/oauth/provider.ts")`.

**Pre-check**: staging may have files from this session. Sessions are active (this session). MCP sees staging + active session → warns but serves. ✅

4. MCP resolves file to node(s) via refs:
   - Scans all nodes' refs for a match on `src/auth/oauth/provider.ts`
   - Finds `comp-oauth` (UUID: abc-123)
   - Traverses up COMPOSES: comp-oauth → feat-auth → App
   - Finds all decisions with AFFECTS edges to comp-oauth or feat-auth
   - Returns: nodes + decisions + full properties

✅ Clean.

### 2.2 Agent Makes Changes

1. Agent modifies `src/auth/oauth/provider.ts`. ✅
2. Agent creates new file `src/auth/oauth/pkce.ts`. ✅
3. Agent decides to use PKCE over implicit flow. This is a decision. ✅
4. Agent writes to staging:

```markdown
## [component] PKCE Flow Handler
timestamp: 2026-03-21T11:00:00Z
alias: comp-pkce
parent: abc-123
description: PKCE challenge/response for OAuth
refs:
  - file: src/auth/oauth/pkce.ts, symbol: PKCEFlow

## [decision] PKCE over implicit OAuth flow
timestamp: 2026-03-21T11:01:00Z
context: Implicit flow is deprecated by OAuth 2.1 spec...
decision: Implement PKCE challenge/response...
tradeoffs: ...
alternatives: Implicit flow (rejected: deprecated)...
files-touched: src/auth/oauth/pkce.ts, src/auth/oauth/provider.ts
tags: security
```

Processing order: component first → pkce.ts gets a node → decision second → `files-touched` resolves `pkce.ts` to the new component, `provider.ts` to `comp-oauth`. ✅

### 2.3 Session End + Sync

1. Agent finishes turn → deregisters. ✅
2. Hook fires sync. ✅
3. Sessions empty → proceed. ✅
4. Read staging file. Parse. Process in order. ✅
5. Component entry: assign UUID to comp-pkce. Resolve `parent: abc-123` (UUID of comp-oauth). Emit `node_added` + `edge_added` (COMPOSES). ✅
6. Decision entry: resolve `files-touched`:
   - `src/auth/oauth/pkce.ts` → matches comp-pkce's refs (just added in step 5) ✅
   - `src/auth/oauth/provider.ts` → matches comp-oauth's refs ✅
   - Emit `node_added` (Decision) + `edge_added` (AFFECTS comp-pkce) + `edge_added` (AFFECTS comp-oauth). ✅
7. Supersede check: are there existing decisions affecting comp-pkce or comp-oauth? If yes → write to reviews.jsonl. ✅
8. Atomic append. Clear staging. Inject stale banner. ✅

**No issues.**

---

## Flow 3: Multi-Agent Scenario

### 3.1 Two Agents Working Simultaneously

1. Agent A registers session-aaa. Agent B registers session-bbb. sessions.json has both. ✅
2. Agent A writes to `staging/session-aaa.md`. Agent B writes to `staging/session-bbb.md`. No contention. ✅
3. Agent A finishes turn → deregisters → hook fires sync.
4. Sync checks sessions.json: session-bbb still active → skip silently. ✅
5. Agent B finishes turn → deregisters → hook fires sync.
6. Sync checks sessions.json: empty → proceed. ✅
7. Sync reads both staging files. Processes all entries respecting order. ✅

**Cross-file alias issue**: Agent A uses `alias: new-thing` in session-aaa.md. Agent B uses `alias: new-thing` in session-bbb.md. Aliases are file-scoped → no collision. Agent A's `new-thing` resolves only within session-aaa.md. ✅

**Cross-file references**: Agent A creates a component. Agent B writes a decision affecting that component. Agent B uses UUID (from MCP query) — but the component doesn't exist in events.jsonl yet (it's in Agent A's staging). Agent B's `files-touched` might resolve if Agent A created the refs. But both are in staging, not events.jsonl yet.

⚠️ AMBIGUITY: During multi-agent sync, `process-staging` processes all files. But `files-touched` resolution requires the graph to include nodes from ALL staging files, not just the current file. The processing order is defined within a file (features → components → ... → decisions). But across files, all features from all files should be processed before all components, etc.

The current design says "parse staging entries from each file, respecting processing order." This is ambiguous — does it mean process file A fully (in order), then file B fully? Or interleave: all features from all files, then all components from all files?

It must be the latter: **merge all entries across all files, then process by type order globally.** Otherwise Agent B's decision can't resolve files that map to Agent A's components.

---

## Flow 4: MCP Tool Deep Dive — `whygraph_context`

1. Agent calls `whygraph_context(file: "src/shared/logger.ts")`.
2. MCP loads events, builds graph.
3. Searches all nodes' refs for file path match.

**Matching strategy**: exact path match? Prefix match? If a feature has `refs: [{ file: "src/auth/" }]` and the agent queries `file: "src/auth/oauth/provider.ts"`, does it match?

⚠️ AMBIGUITY: File path matching for `whygraph_context`. A feature might reference a directory (`src/auth/`), a component might reference a specific file (`src/auth/oauth/provider.ts`). The query `file: "src/auth/oauth/provider.ts"` should match both — the specific component AND the parent feature (via directory prefix). But the design doesn't specify the matching algorithm.

Proposed: match the most specific node whose refs include the file. Also match ancestor nodes whose directory refs are a prefix of the file path. Return all matches with their decisions.

4. If no match found — return error: "File not found in any node's refs."

⚠️ AMBIGUITY: The error should probably suggest running `/whygraph-scan` to map unmapped files, rather than just failing.

---

## Flow 5: Tag Filtering in Viz — Edge Cases

### 5.1 All tags off

User toggles off all 7 tags. No decisions match. No structural nodes are ancestors of visible decisions.

**Result**: only the App node remains (it's always the root). Everything else disappears.

Or should the viz prevent all-off? Show a message: "No tags selected"?

⚠️ AMBIGUITY: Behavior when all tags are toggled off. Empty graph or prevented state?

### 5.2 Tag filtering + timeline scrubber

User has `security` tag active. Scrubs to an early timestamp where no security decisions exist yet.

**Result**: no decisions match → no structural nodes shown (except App). The graph is effectively empty despite structural nodes existing at that timestamp.

Is this confusing? The user might think the app didn't exist at that point, when really it did but had no security decisions yet.

⚠️ AMBIGUITY: Should tag filtering only apply to decisions, leaving structural nodes always visible at their scrubber position? Or should the "slice" behavior always apply, even when combined with timeline?

---

## Flow 6: Deprecation

1. Agent detects that `comp-api-v1` is deprecated in favor of `comp-api-v2`.
2. Agent writes staging:

```markdown
## [deprecate] <uuid-api-v1> <uuid-api-v2>
timestamp: 2026-03-21T15:00:00Z
```

3. Sync processes: emits `edge_added` (DEPRECATES from v2 to v1) + `node_patched` (v1 status: deprecated). ✅

**Wait**: DEPRECATES edge direction. The design says `Component → Component` and `Feature → Feature`. Which direction? Is it "new deprecates old" (v2 → v1) or "old is deprecated by new" (v1 → v2)?

The staging format is `[deprecate] <old-uuid> <new-uuid>`. The edge should be FROM new TO old: "v2 DEPRECATES v1." Consistent with SUPERSEDES: "new SUPERSEDES old."

⚠️ MINOR: Confirm edge direction — from new to old (the new thing deprecates the old thing).

---

## Flow 7: Review Resolution via `[resolve-review]`

1. reviews.jsonl has:
```json
{"newDecisionId":"uuid-new","existingDecisionId":"uuid-old","sharedNodeIds":["uuid-comp"],"status":"pending"}
```

2. Agent calls `whygraph_get_reviews()`. Gets the review. ✅
3. Agent presents to user. User confirms supersede.
4. Agent writes staging:

```markdown
## [resolve-review] ???
timestamp: 2026-03-21T16:00:00Z
action: supersede
```

**What identifies the review entry?** The staging format says `[resolve-review] review-line-id`. But reviews.jsonl entries don't have IDs — they're just JSON lines. How does the agent reference a specific review?

⚠️ AMBIGUITY: Review entry identification. Options:
- Add an `id` field to review entries (UUID assigned when review is created)
- Use `newDecisionId` + `existingDecisionId` as a composite key
- Use line number (fragile)

Review entries need an ID.

---

## Flow 8: `whygraph viz` Staleness Checks

1. User runs `whygraph viz`.
2. Check staging directory.
   - Files exist + no sessions → reject. ✅
   - Files exist + sessions active → ⚠️ DESIGN_DECISIONS.md says viz rejects on staleness ("Run `whygraph sync` first") but the staleness table says "Warn but still bake" when sessions are active.

These are consistent: staging + no sessions = reject, staging + active sessions = warn but bake. ✅

3. Check sessions for viz: should viz warn if sessions are active (even without staging files)? Currently no — only staleness and reviews trigger warnings. Sessions without staging files means agents are working but haven't written anything yet. No issue. ✅

---

## Flow 9: Process-Staging Ref Resolution

1. Sync processes a `[ref-update]` entry with `add` and `remove`.
2. `process-staging` builds the graph from events.jsonl.
3. Gets the node's current refs from the graph.
4. Applies add (append new refs) and remove (filter out matching refs).
5. Emits `node_patched` with the full merged refs array.

**Question**: what if a `remove` ref doesn't exist in the current refs? Silent ignore or error?

⚠️ MINOR: Removing a ref that doesn't exist — should be a silent no-op (defensive) or validation error?

---

## Summary of Pass 2 Findings

### New Ambiguities Found

1. **Interview flow can't use `files-touched`** — the agent didn't modify files, it's capturing rationale for existing code. Needs a way to reference nodes directly (UUIDs from `get_gaps`).

2. **Multi-agent sync processing order** — must be global across all files (all features from all files → all components → ...), not per-file sequential.

3. **`whygraph_context` file path matching algorithm** — exact match, prefix match for directories, or both? How does a directory ref (`src/auth/`) match a file query (`src/auth/oauth/provider.ts`)?

4. **All tags off in viz** — empty graph or prevented state?

5. **Tag filtering + timeline interaction** — structural nodes disappear at timestamps where they exist but have no matching decisions.

6. **Review entry identification** — entries need IDs for `[resolve-review]` to reference them.

7. **DEPRECATES edge direction** — confirm new → old (consistent with SUPERSEDES).

8. **Removing non-existent ref** — silent no-op or error?

### Consistency Issues Found

1. **Architecture diagram** still says `per-entry files (one per staging entry)` — should say `per-session files (one per agent session)`.
2. **Agent instructions** still reference `whygraph_get_subgraph` — should reference `whygraph_context`.
3. **Review resolution section** still describes the agent writing `node_patched + edge_added` to staging — should reference `[resolve-review]` entry type.
