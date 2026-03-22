# Whygraph — Application Flow Simulation

Simulated walkthrough of every user-facing flow path. Each flow is traced step by step against the design documents. Branches are traversed. Ambiguities are flagged inline with `⚠️ AMBIGUITY` and collected in OPEN_QUESTIONS.md.

---

## Flow 1: First-Time Setup (New Project)

### 1.1 User installs whygraph

```
npm install --save-dev whygraph
```

- **Result**: `whygraph` binary available via `npx`.
- No `.whygraph/` directory yet.

### 1.2 User runs `whygraph init`

```
npx whygraph init
```

**Step 1**: Check if `.whygraph/events.jsonl` exists.
- **Branch A**: File does not exist → proceed with fresh init.
- **Branch B**: File exists → idempotent path (see Flow 2).

**Proceeding with Branch A (fresh init):**

**Step 2**: Guided prompts (via `prompts` library):

```
? Environment: (Claude Code) / Cursor / Copilot / Other
? Sync trigger: (Hook) / Git hook / Manual
? Context injection: (Always) / Ask / Never
? Autonomy level: (Supervised) / Full / Manual
? App name: My App
```

Defaults in parentheses. User presses enter through all = Claude Code defaults.

**Step 3**: Display autonomy disclaimer.

**Step 4**: Create `.whygraph/` directory structure:
- `.whygraph/events.jsonl` (empty)
- `.whygraph/staging/` (empty directory)
- `.whygraph/config.json`

⚠️ AMBIGUITY: Init step 6 in DESIGN_DECISIONS.md still says `staging.md` instead of `staging/` directory. Document inconsistency — should be `staging/`.

**Step 5**: Write `config.json`:
```json
{
  "appName": "My App",
  "environment": "claude-code",
  "syncTrigger": "hook",
  "contextInjection": "always",
  "autonomy": "supervised"
}
```

**Step 6**: Write App `node_added` event directly to `events.jsonl`:
```json
{"type":"node_added","timestamp":"2026-03-21T10:00:00Z","id":"<generated-uuid>","label":"App","properties":{"name":"My App"}}
```

⚠️ AMBIGUITY: Who generates the UUID for the App node? `process-staging` normally assigns UUIDs, but init bypasses staging. Init must generate a UUID itself. This is a one-time exception — needs to be documented as a design note, not an open question. Using Node's `crypto.randomUUID()`.

**Step 7**: Generate platform-specific files.

**Branch by environment:**

- **Claude Code**:
  - Write skill/prompt files. ⚠️ AMBIGUITY: Where exactly? `.claude/skills/whygraph/`? What's the skill file format/content? The design says "generate platform-specific files" but doesn't specify the output paths or content for Claude Code skills.
  - Write MCP config. ⚠️ AMBIGUITY: Where? `.claude/settings.json` under `mcpServers`? Or `.claude/mcp.json`? Claude Code has evolved — which config file is current?
  - Install Claude Code hook in `settings.json`.
    - ⚠️ AMBIGUITY: What hook event type? The design says "after agent finishes a turn." What's the exact Claude Code hook configuration? Is it `postToolCall`, `postResponse`, or something else? What command does the hook run?

- **Cursor**:
  - Write `.cursorrules` with whygraph agent instructions.
  - Install git hook at `.git/hooks/post-commit`.
    - Hook content: `npx whygraph sync`

- **Copilot**:
  - Write `.github/copilot-instructions.md` with whygraph agent instructions.
  - Install git hook at `.git/hooks/post-commit`.

- **Other**:
  - Write generic instructions file. ⚠️ AMBIGUITY: Where? What format? `.whygraph/AGENT_INSTRUCTIONS.md`?
  - Prompt user to set up hooks manually.

**Step 8**: Bake initial viz.
- Read `events.jsonl` (single App node).
- Build one snapshot: `{ timestamp: "...", graph: { nodes: [App], edges: [] } }`.
- Generate `.whygraph/viz/index.html` with embedded D3 + snapshot.
- Open in browser.

⚠️ AMBIGUITY: The `viz/` directory doesn't exist yet. Init needs to create `.whygraph/viz/` before writing `index.html`.

**Step 9**: Print handoff instructions:
```
Whygraph initialized.

To map your codebase, run this in your agent:
  /whygraph-scan
```

**Init complete.** User sees a browser tab with a single App node.

---

## Flow 2: Idempotent Init (Already Initialized)

User runs `npx whygraph init` again.

**Step 1**: `.whygraph/events.jsonl` exists → idempotent path.

**Step 2**: Read `config.json`. Compare against current state:
- Are hooks installed? If not, reinstall.
- Do platform-specific files exist? If not, regenerate.
- Has the environment changed? ⚠️ AMBIGUITY: How does init know if the environment changed if it's running fresh with no arguments? Does it re-prompt? Or does it read the existing config and only repair missing pieces without prompting?

**Step 3**: Check if features exist in the graph.
- Read `events.jsonl`, look for `node_added` events with `label: "Feature"`.
- If none: "No features found. Run `/whygraph-scan` to map your codebase."
- If features exist: "Whygraph is already initialized and populated."

---

## Flow 3: Codebase Scan (`/whygraph-scan`)

User pastes `/whygraph-scan` into Claude Code (or equivalent).

**Prerequisite**: `whygraph init` has run. App node exists. MCP server is configured.

**Step 1**: Agent skill activates. Agent registers session in `sessions.json`.

⚠️ AMBIGUITY: How does the agent register? The skill instructs it to write to `sessions.json`. But `sessions.json` might not exist yet (init doesn't create it). Does the agent create it? Does init create it empty? Or does the registration logic handle a missing file?

**Step 2**: Agent reads the codebase (source files, directory structure, package.json, etc.).

**Step 3**: Agent proposes feature/component tree:
```
I've identified the following structure:
- Feature: Authentication (src/auth/)
  - Component: OAuth Provider (src/auth/oauth/provider.ts → OAuthProvider)
  - Component: Session Manager (src/auth/session.ts → SessionManager)
- Feature: API (src/api/)
  - Component: Route Handler (src/api/routes.ts → registerRoutes)
  - Component: Middleware (src/api/middleware/)
- Component: Logger (src/shared/logger.ts → Logger) [shared, under App]

Does this look right?
```

**Step 4**: User confirms or corrects.

**Step 5**: Agent writes staging entries as individual files in `.whygraph/staging/`:

File `staging/001-feat-auth.md`:
```markdown
## [feature] Authentication
alias: feat-auth
description: User authentication and session management
refs:
  - file: src/auth/
```

File `staging/002-comp-oauth.md`:
```markdown
## [component] OAuth Provider
alias: comp-oauth
parent: feat-auth
description: OAuth provider integration
refs:
  - file: src/auth/oauth/provider.ts, symbol: OAuthProvider
```

...and so on for each node.

⚠️ AMBIGUITY: The `parent` field for components under a feature uses an alias (`feat-auth`). But `feat-auth` is defined in a different staging file. When `process-staging` reads all files from `staging/`, does it process them in order? Does it do a two-pass resolution (first pass assigns UUIDs to all aliases, second pass resolves references)? The current design says aliases are resolved within a "batch" but doesn't specify the resolution algorithm across multiple files.

**Step 6**: Agent finishes turn → hook fires → deregisters from `sessions.json` → triggers `whygraph sync`.

**Step 7**: `whygraph sync` runs:
1. Check `sessions.json` — empty → proceed.
2. Acquire lock.
3. Read all files from `staging/` (001-feat-auth.md, 002-comp-oauth.md, ...).
4. Parse all entries.
5. First pass: assign UUIDs to all new nodes. Build alias → UUID map.
6. Second pass: resolve alias references (e.g., `parent: feat-auth` → UUID).
7. Validate (parent exists — either as alias in this batch or UUID in events.jsonl).
8. No supersede candidates (these are structural nodes, not decisions).
9. Serialize events, atomic append to `events.jsonl`.
10. Inject stale banner into viz HTML (if it exists).
11. Delete staging files.
12. Release lock.

**Step 8**: Agent offers `/whygraph-interview`:
```
Codebase mapped. Want to capture historical decisions? Run /whygraph-interview
```

---

## Flow 4: Agent Work Session (Normal Development)

Agent is tasked with adding a new feature or modifying existing code.

### 4.1 Session Start

**Step 1**: Agent skill registers session in `sessions.json`.

**Step 2**: Agent checks context injection config (from `config.json` or skill instructions).

**Branch A — Context injection = "always":**
Agent calls MCP: `whygraph_get_subgraph(node_id_of_feature_being_modified)`.

  **Branch A.1 — MCP succeeds**: Returns subgraph with decisions. Agent has context.

  **Branch A.2 — MCP rejects (staging has files)**:
  "Sync needed. Unprocessed staging entries exist."

  ⚠️ AMBIGUITY: This is a problem. The agent just registered its session. If there are leftover staging files from a previous session, sync won't run because `sessions.json` is non-empty (the current session is active). The MCP rejects because staging has files. The agent can't proceed because MCP won't serve data. Deadlock.

  Resolution path: the MCP staleness check should consider whether the active sessions include the current agent. Or: staging from previous sessions should have been synced when those sessions ended. If staging files exist with an active session, it means either (a) a previous session crashed, or (b) this session is the one that created them. Case (b) can't happen at session start. Case (a) needs `--flush`.

  But the agent can't run `whygraph sync --flush` — that's a CLI command. The agent would need to tell the user to run it.

  **Branch A.3 — MCP rejects (stale sessions)**:
  "Sync blocked by stale sessions. Run `whygraph sync --flush`."
  Agent surfaces this to user. User runs `whygraph sync --flush`. Agent retries MCP.

**Branch B — Context injection = "ask":**
Agent asks user: "Whygraph wants to use ~2K tokens to load decisions for feat-auth. Allow?"
  - User says yes → same as Branch A.
  - User says no → agent proceeds without context.

**Branch C — Context injection = "never":**
Agent skips MCP query. Proceeds without whygraph context.

### 4.2 Agent Does Work

Agent writes code. Makes implementation decisions along the way.

**Step 1**: Agent writes code to files (normal development).

**Step 2**: For each decision made, agent writes a staging file:

File `staging/003-jwt-decision.md`:
```markdown
## [decision] Use JWT over session cookies
context: ...
decision: ...
tradeoffs: ...
alternatives: ...
affects: <uuid-of-comp-session>
tags: security, arch
```

**Step 3**: If agent creates a new file/module that constitutes a new component:

File `staging/004-new-comp.md`:
```markdown
## [component] PKCE Flow Handler
alias: comp-pkce
parent: <uuid-of-comp-oauth>
description: Handles PKCE challenge/response for OAuth
refs:
  - file: src/auth/oauth/pkce.ts, symbol: PKCEFlow
```

**Step 4**: If agent modifies existing code and a ref changes:

File `staging/005-ref-update.md`:
```markdown
## [ref-update] <uuid-of-comp-oauth>
add:
  - file: src/auth/oauth/pkce.ts, symbol: PKCEFlow
```

⚠️ AMBIGUITY: In step 3, the agent creates a new component AND its ref includes `pkce.ts`. In step 4, the agent also stages a ref-update adding `pkce.ts` to the parent component. Are these two different operations? The new component owns `pkce.ts` via its own refs. Should the parent also reference it? This depends on whether refs are exclusive (a symbol belongs to one component) or shared (a symbol can be referenced by multiple components). The design doesn't specify.

**Step 5**: If agent detects a deprecation signal:

File `staging/006-deprecation.md`:
```markdown
## [deprecation] <uuid-of-comp-old> <uuid-of-comp-new>
```

⚠️ AMBIGUITY: There's no `[deprecation]` staging entry type defined. The design says agents "stage the deprecation relationship" but the staging format only defines: `[decision]`, `[component]`, `[feature]`, `[ref-update]`, `[node-removed]`. How is a DEPRECATES edge staged? Need a new entry type, or does it use `[edge-added]`? Neither exists.

### 4.3 Session End

**Step 1**: Agent finishes turn.

**Step 2**: Hook fires (Claude Code) or user commits (git hook).

**Step 3**: Hook deregisters agent from `sessions.json`.

**Step 4**: Hook triggers `whygraph sync`.

**Branch A — Other sessions still active:**
Sync checks `sessions.json` → other agents active → skip silently.

**Branch B — No other sessions:**
Sync proceeds (see Flow 6: Sync).

---

## Flow 5: Decision Interview (`/whygraph-interview`)

User runs `/whygraph-interview` in their agent.

**Step 1**: Agent registers session in `sessions.json`.

**Step 2**: Agent calls MCP: `whygraph_get_gaps(10)`.

**Branch A — MCP succeeds**: Returns up to 10 nodes with no decisions.

**Branch B — MCP rejects (staging files exist)**:
Same deadlock potential as Flow 4.1 Branch A.2.

**Proceeding with Branch A:**

**Step 3**: Agent presents gaps to user:
```
These components have no recorded decisions:
1. OAuth Provider (comp-oauth) - under Authentication
2. Session Manager (comp-session) - under Authentication
3. Route Handler (comp-routes) - under API
...

Let's start with OAuth Provider. Why was it built the way it is?
```

**Step 4**: User responds:
```
We went with Google and GitHub as OAuth providers because those cover 90% of our users. We considered Auth0 but rejected it because of the cost at our scale.
```

**Step 5**: Agent parses response, writes staging file:

File `staging/007-oauth-decision.md`:
```markdown
## [decision] Google and GitHub as OAuth providers over Auth0
context: Need to support third-party authentication. 90% of
  user base uses Google or GitHub accounts.
decision: Integrated Google and GitHub OAuth providers directly
  using their SDKs rather than an auth aggregator.
tradeoffs: Gained direct control and zero per-auth cost. Lost
  single integration point and easy addition of new providers.
alternatives: Auth0 (rejected: cost prohibitive at scale, adds
  external dependency). Firebase Auth (rejected: ties us to GCP
  ecosystem). Cognito (rejected: AWS lock-in, poor developer UX).
affects: <uuid-of-comp-oauth>
tags: security, integration
```

**Step 6**: Agent asks about next gap or user says "that's all for now."

**Branch A — User continues**: repeat from Step 3 with next gap.

**Branch B — User stops**: Agent deregisters session. Hook fires sync.

**Step 7**: Next time user runs `/whygraph-interview`, `whygraph_get_gaps` returns different nodes (previously covered ones now have decisions).

---

## Flow 6: Sync (`whygraph sync`)

### 6.1 Hook-Triggered Sync

Hook fires after agent turn ends.

**Step 1**: Check `sessions.json`.
- **Active sessions exist** → skip silently. Exit.
- **No active sessions** → proceed.

**Step 2**: Acquire `.whygraph/.lock`.
- **Lock acquired** → proceed.
- **Lock already held** → wait or exit. ⚠️ AMBIGUITY: Wait or exit? The design says "second instance waits or exits." Which one? If it waits, for how long? If it exits, the staging files survive to the next sync trigger. Exiting is probably fine since the hook will fire again on the next trigger.

**Step 3**: Read all files from `.whygraph/staging/`.
- **No files** → nothing to process. Release lock. Exit.
- **Files found** → proceed.

**Step 4**: Parse staging entries from each file.

⚠️ AMBIGUITY: What order are staging files processed in? Alphabetical by filename? The agent names them `001-...`, `002-...` suggesting order matters for alias resolution across files. But in a multi-agent scenario, Agent A might write `001-feat.md` and Agent B might write `001-comp.md`. Does filename ordering matter? Or is the two-pass alias resolution (first assign all UUIDs, then resolve all references) order-independent?

If two-pass resolution: order doesn't matter. All aliases in all files are collected first, then resolved. This works as long as no two entries across different files use the same alias.

⚠️ AMBIGUITY: What if two agents use the same alias in different staging files? e.g., both use `alias: new-comp`. `process-staging` would have a collision. Should aliases be globally unique? Or scoped per file?

**Step 5**: Assign UUIDs to all new nodes/edges. Build alias → UUID map.

**Step 6**: Validate each entry.

Validation includes:
- Required fields present for the entry type
- `affects` UUIDs exist in `events.jsonl` or as aliases in this batch
- `parent` UUID exists in `events.jsonl` or as alias in this batch
- `supersedes` UUID exists in `events.jsonl`
- Tags are from the fixed taxonomy
- Date is valid YYYY-MM-DD (for decisions)

**Branch per entry:**
- **Valid** → continue to step 7.
- **Invalid** → move to `errors.jsonl` with error details. Delete staging file.

**Step 7**: For valid decision entries, check for supersede candidates.
- Load all existing decisions from `events.jsonl`.
- For each new decision, find existing decisions that AFFECT the same node(s).
- **Overlap found** → write to `reviews.jsonl`.
- **No overlap** → proceed normally.

**Step 8**: Build all events in memory.

For a `[decision]` entry, emit:
```json
{"type":"node_added","timestamp":"<now>","id":"<uuid>","label":"Decision","properties":{...}}
{"type":"edge_added","timestamp":"<now>","id":"edge-<uuid>","label":"AFFECTS","from":"<decision-uuid>","to":"<affected-node-uuid>"}
```

For a `[component]` entry, emit:
```json
{"type":"node_added","timestamp":"<now>","id":"<uuid>","label":"Component","properties":{...}}
{"type":"edge_added","timestamp":"<now>","id":"edge-<uuid>","label":"COMPOSES","from":"<parent-uuid>","to":"<component-uuid>"}
```

⚠️ AMBIGUITY: Timestamp — is it the current time when sync runs, or should each staging entry carry its own timestamp? If the agent wrote the entry 10 minutes ago but sync runs now, which timestamp is used? This matters for the timeline scrubber. If all entries in a batch get the same "now" timestamp, they all collapse into one snapshot. If they carry capture-time timestamps, they spread across the timeline.

For a `[feature]` entry, emit:
```json
{"type":"node_added","timestamp":"<now>","id":"<uuid>","label":"Feature","properties":{...}}
{"type":"edge_added","timestamp":"<now>","id":"edge-<uuid>","label":"COMPOSES","from":"<app-uuid>","to":"<feature-uuid>"}
```

For a `[ref-update]` entry, emit:
```json
{"type":"node_patched","timestamp":"<now>","id":"<node-uuid>","properties":{"refs":[...]}}
```

⚠️ AMBIGUITY: For `[ref-update]`, the staging format has `add` and `remove` fields. But `node_patched` takes a full `properties` partial. Does `process-staging` need to load the current refs from the graph, apply the add/remove diff, and emit the merged result? Or does `node_patched` support incremental ref operations? The current event schema only supports `Partial<DecisionProperties>` for patches. Refs on structural nodes would need `Partial<NodeProperties>`. The patch semantics for arrays (refs) need to be defined — is it a full replacement or a merge?

For a `[node-removed]` entry, emit:
```json
{"type":"node_removed","timestamp":"<now>","id":"<node-uuid>"}
{"type":"edge_removed","timestamp":"<now>","id":"<edge-uuid-1>"}
{"type":"edge_removed","timestamp":"<now>","id":"<edge-uuid-2>"}
...
```

`process-staging` queries the current graph to find all edges connected to the node and emits `edge_removed` for each.

**Step 9**: Serialize all events as a single string. `fs.appendFile` to `events.jsonl`.

**Step 10**: Check if `.whygraph/viz/index.html` exists.
- **Yes** → open file, inject stale banner HTML, save.
- **No** → skip (viz hasn't been baked yet).

**Step 11**: Delete all processed staging files.

**Step 12**: Release `.whygraph/.lock`.

### 6.2 Manual Sync

User runs `npx whygraph sync`.

Same as 6.1 except:
- **Step 1**: If sessions are active, don't skip — prompt user:
  ```
  2 active sessions are blocking sync:
    session-abc123 (claude-code, started 2h ago)
    session-def456 (cursor, started 45m ago)
  Force sync and clear all sessions? (y/n)
  ```
- User says yes → clear sessions, proceed.
- User says no → exit.

### 6.3 Flush Sync

User runs `npx whygraph sync --flush`.

Same as 6.1 except:
- **Step 1**: Clear all sessions unconditionally. Proceed.

---

## Flow 7: Viz Bake (`whygraph viz`)

User runs `npx whygraph viz`.

**Step 1**: Check staleness.
- **Staging files exist** → reject: "Run `whygraph sync` first." Exit.
- **No staging files** → proceed.

⚠️ AMBIGUITY: Should viz also check `sessions.json`? If sessions are active, staging might be accumulating. The viz would be baked from a partial state. The design says viz rejects on staleness (staging files) but doesn't mention session checks. Should it warn if sessions are active? "Active agent sessions detected — viz may not reflect all pending changes."

**Step 2**: Read `events.jsonl`. Parse all events.

**Step 3**: Build snapshots.
- Group events by unique timestamp.
- For each unique timestamp, replay all events up to and including that timestamp via `buildGraphAt`.
- Produce array of `{ timestamp, graph: { nodes, edges } }`.

**Step 4**: Check `reviews.jsonl` for pending review count.

**Step 5**: Generate HTML.
- HTML template with:
  - Inline D3.js v7 (~280KB)
  - `SNAPSHOTS` array
  - `BAKED_AT` timestamp
  - `REVIEW_COUNT`
  - Legend
  - Tag filter bar
  - Timeline scrubber
  - Side panel
  - Focus+context interaction JS
  - URL hash state management

**Step 6**: Write to `.whygraph/viz/index.html`.

**Step 7**: Remove stale banner (if present from previous sync injection — the fresh bake has no banner).

**Step 8**: Open in browser.

⚠️ AMBIGUITY: How does the CLI open a browser? `open` on macOS, `xdg-open` on Linux, `start` on Windows? Or use a package like `open`? This is a dependency question.

---

## Flow 8: MCP Tool Calls

Agent calls an MCP tool during work.

### 8.1 Pre-checks (All Tools)

**Step 1**: Check staging directory.
- **Files exist** → return error: `{ isError: true, content: "Whygraph has unprocessed staging entries. Run whygraph sync before querying." }`

**Step 2**: Check `sessions.json`.
- **Stale sessions** → return error with flush instructions.
- ⚠️ AMBIGUITY: How does the MCP server distinguish between "active session that's legitimately working" and "stale crashed session"? It can't — it only sees entries in `sessions.json`. If the calling agent has a registered session, is that considered "active" or should the MCP server exclude the current caller? The MCP server doesn't know the caller's session ID.

  Resolution path: The MCP server should not reject for active sessions — sessions are about gating sync, not reads. The MCP should only reject if staging files exist (staleness gate). Active sessions just mean sync is deferred. But if staging files exist AND sessions are active, the MCP rejects on staleness, and the agent knows sync is deferred because sessions are active.

  Actually, rethinking: if sessions are active, staging files are expected to accumulate. The MCP shouldn't reject just because staging exists while sessions are active — that's the normal multi-agent state. The MCP should reject on staging ONLY if sessions.json is empty (meaning sync should have run but didn't).

  ⚠️ AMBIGUITY — HARD: This changes the staleness logic. MCP should reject if `staging/ has files AND sessions.json is empty`. If sessions are active, staging is expected — MCP should serve from the last-synced state in `events.jsonl` with a warning that data may be incomplete.

**Step 3**: Check `reviews.jsonl`.
- **Has entries** → include warning in response: "N decisions pending review."

**Step 4**: Check `errors.jsonl`.
- **Has entries** → include warning in response: "N staging entries failed validation."

**Step 5**: `loadEvents()` → read `events.jsonl`, parse all events.

**Step 6**: `buildGraph()` → replay events into graphology MultiDirectedGraph.

### 8.2 `whygraph_get_subgraph(node_id, depth?)`

**Step 7**: Look up `node_id` in graph.
- **Not found** → return error.
  - ⚠️ AMBIGUITY: Should the error suggest similar nodes? Or list all top-level nodes? The original spec's `get_feature` listed available feature IDs on not-found. Should `get_subgraph` do the same?

**Step 8**: BFS from `node_id` over COMPOSES edges to `depth` (default: unlimited).

**Step 9**: Collect all AFFECTS and SUPERSEDES and DEPRECATES edges involving returned nodes.

**Step 10**: Serialize full node attributes and edge attributes. Return.

### 8.3 `whygraph_get_decisions(filters)`

**Step 7**: Iterate over all Decision nodes in the graph.

**Step 8**: Apply filters (AND logic):
- `feature_id` → decision AFFECTS this feature or any of its components
- `component_id` → decision AFFECTS this component
- `status` → match decision status
- `tags` → decision has at least one matching tag ⚠️ AMBIGUITY: Is tag filtering OR or AND? If I pass `tags: ["security", "data"]`, does it match decisions with security OR data, or security AND data? The viz uses OR. Should the MCP filter match?
- `after` → decision date >= after
- `before` → decision date <= before

**Step 9**: Return full attributes for matching decisions.

### 8.4 `whygraph_get_history(node_id)`

**Step 7**: Look up `node_id` — can be any node type.

**Step 8**: Find all decisions that AFFECT this node (directly).

**Step 9**: For each decision, follow SUPERSEDES chains in both directions.

**Step 10**: Order by date ascending. Return chain with full attributes.

⚠️ AMBIGUITY: If `node_id` is a feature, does `get_history` also include decisions affecting the feature's components? Or only decisions directly affecting the feature node? The design says "decision chain for a node" but doesn't clarify whether it traverses COMPOSES downward first.

### 8.5 `whygraph_get_gaps(limit?)`

**Step 7**: Iterate over all Feature and Component nodes in the graph.

**Step 8**: For each, check if any Decision has an AFFECTS edge pointing to it.

**Step 9**: Return up to `limit` nodes that have no AFFECTS edges, with their name, type, and position in hierarchy.

⚠️ AMBIGUITY: What's the ordering of gap results? Random? Alphabetical? Hierarchical (features first, then top-level components, then deeper)? Hierarchical makes sense for the interview flow — start with the broadest gaps.

---

## Flow 9: Review Resolution

### 9.1 Agent-Initiated (Supervised Autonomy)

**Step 1**: Agent starts a turn. Checks for pending reviews (MCP tools warn about them).

**Step 2**: Agent reads `reviews.jsonl` (directly or via MCP warning).

⚠️ AMBIGUITY: Can the agent read `reviews.jsonl` directly? Or does it need an MCP tool? The current MCP tools don't include a "get reviews" tool. The agent would need to read the file directly via filesystem access. This works in Claude Code but might not work in all platforms. Should there be a `whygraph_get_reviews()` MCP tool?

**Step 3**: Agent presents review to user:
```
A potential supersede was detected:
- New: "Use JWT over session cookies" (affects comp-session)
- Existing: "Session-based auth with cookie storage" (affects comp-session)

Does the new decision supersede the existing one? (yes/no)
```

**Step 4**:
- **User says yes** → Agent writes staging file:

  File `staging/008-supersede-resolution.md`:
  ```markdown
  ## [supersede] <new-decision-uuid> <old-decision-uuid>
  ```

  ⚠️ AMBIGUITY: There's no `[supersede]` staging entry type defined. The design says the agent writes `node_patched` + `edge_added` to staging. But the staging format doesn't have a generic "emit these events" entry type. Need either a `[supersede]` type, or the agent writes two separate entries:

  File `staging/008a-patch-old.md`:
  ```markdown
  ## [node-patch] <old-decision-uuid>
  status: superseded
  ```

  File `staging/008b-supersede-edge.md`:
  ```markdown
  ## [edge-added] SUPERSEDES <new-decision-uuid> <old-decision-uuid>
  ```

  ⚠️ AMBIGUITY: Neither `[node-patch]` nor `[edge-added]` are defined staging entry types. The staging format needs to support direct event emission for review resolutions. Options: (1) add these entry types, (2) add a `[supersede]` entry type that emits both, (3) add a `[resolve-review]` entry type.

- **User says no (dismiss)** → The review needs to be cleared without creating a supersede relationship.

  ⚠️ AMBIGUITY: How does a dismissed review get removed from `reviews.jsonl`? There's no staging entry type for "dismiss review." Does the agent write directly to `reviews.jsonl`? Does `process-staging` handle dismissals? Need a mechanism.

### 9.2 Manual Review (Manual Autonomy)

User runs `npx whygraph sync`. Sync surfaces reviews:
```
2 decisions pending review:

1. "Use JWT over session cookies" may supersede "Session-based auth"
   Both affect: comp-session
   → Supersede? (y/n/skip)

2. "PostgreSQL for user data" may supersede "SQLite for local storage"
   Both affect: comp-db
   → Supersede? (y/n/skip)
```

⚠️ AMBIGUITY: Sync is supposed to be a deterministic script. But manual review resolution requires interactive prompting. Does sync use `prompts` for this? Or does it just print the reviews and tell the user to resolve them separately? The design says sync "surfaces review items, offers to resolve on the spot" — this implies interactive prompting during sync.

---

## Flow 10: Config Change

User runs `npx whygraph config --autonomy full`.

**Step 1**: Read `.whygraph/config.json`.

**Step 2**: Update the specified field: `autonomy: "full"`.

**Step 3**: Write updated `config.json`.

**Step 4**: Regenerate platform-specific files.

⚠️ AMBIGUITY: If the user changes `environment` from `claude-code` to `cursor`, config needs to:
- Remove Claude Code hooks/skills
- Add .cursorrules
- Install git hook
- Remove MCP config from Claude Code settings

Does config handle platform migration? Or does it just update the config file and regenerate, potentially leaving orphaned files from the old platform?

---

## Flow 11: Visualization Interaction

User has the viz open in a browser.

### 11.1 Default View

- Full graph rendered with D3 force simulation.
- App node centered, features spaced around it, components clustered near parents.
- Decision diamonds floating near affected nodes.
- Tag filter bar at top (all 7 chips active).
- Timeline scrubber at bottom (at max position = current state).
- Legend visible.
- Bake timestamp in footer.
- If reviews pending: review banner visible.

### 11.2 Focus on Feature

User clicks a Feature (rounded rectangle).

- Feature's subtree spreads out (COMPOSES children).
- Decisions affecting this feature and its components remain visible.
- Everything else fades to 10-20% opacity.
- View recenters on the feature.
- Cross-cutting decisions (affecting nodes outside this feature) show dimmed edges to faded nodes.
- URL hash updates: `#focus=<feature-uuid>&t=<current-snapshot>`
- Side panel slides in showing feature detail.

### 11.3 Drill into Component

User clicks a Component within the focused feature.

- That component's children spread.
- Siblings and their subtrees compress.
- View recenters on the component.
- Side panel updates to show component detail.
- URL hash updates.

### 11.4 Click Decision

User clicks a Decision diamond.

- Side panel shows decision detail:
  - Title + status chip + tags
  - Date
  - Collapsible sections: Context, Decision, Trade-offs, Alternatives
  - Affects list (clickable chips)
  - Supersedes / Superseded-by links

### 11.5 Tag Filtering

User clicks the "security" tag chip to toggle it OFF.

- All decisions NOT tagged "security" remain.
- Decisions tagged ONLY "security" (and no other active tag) disappear.
- Structural nodes that lose all their visible decisions... ⚠️ AMBIGUITY: Do structural nodes without any visible decisions disappear? The design says "everything else disappears" but structural nodes exist independently of decisions. A feature with only security decisions would have no visible decisions. Does the feature disappear too? That would leave a gap in the COMPOSES hierarchy.

  Possible resolution: structural nodes always remain if they have children with visible decisions. Leaf structural nodes with no visible decisions disappear. But this could disconnect the hierarchy.

  Alternative: structural nodes that are in the COMPOSES chain of any visible node always remain. Only structural nodes with NO visible descendants (decisions or children with decisions) disappear.

### 11.6 Timeline Scrubbing

User drags the scrubber leftward.

- Graph shrinks as newer nodes disappear.
- Focus state persists — if focused node still exists, focus stays.
- If focused node doesn't exist at this snapshot, focus clears (full graph, full opacity).
- Scrubber label shows the snapshot date.
- URL hash updates with `t=<snapshot-index>`.

### 11.7 Refresh After Sync

1. Agent works, writes staging entries.
2. Agent turn ends, hook fires sync.
3. Sync appends events, injects stale banner into viz HTML.
4. User hits F5 in browser.
5. Browser reloads the modified HTML.
6. User sees stale banner: "Run `whygraph viz` to update this visualization."
7. User runs `npx whygraph viz`.
8. Fresh bake, no banner. User hits F5 again — sees updated graph.

---

## Flow 12: Error Recovery

### 12.1 Invalid Staging Entry

Agent writes a staging file with missing `context` field on a decision.

**Step 1**: Sync processes staging.
**Step 2**: Validation fails on this entry.
**Step 3**: Entry written to `errors.jsonl`:
```json
{"entry":"## [decision] Bad decision\ndecision: did a thing\n...","error":"Missing required field: context","file":"staging/003-bad.md"}
```
**Step 4**: Staging file deleted.
**Step 5**: Next MCP call includes warning: "1 staging entry failed validation."
**Step 6**: Agent reads `errors.jsonl`.

⚠️ AMBIGUITY: Same question as reviews — can the agent read `errors.jsonl` directly? Should there be a `whygraph_get_errors()` MCP tool?

**Step 7**: Agent rewrites the entry with the missing field. Writes new staging file.
**Step 8**: Next sync processes it successfully.

### 12.2 Crashed Agent Session

Agent crashes mid-turn. Session stays in `sessions.json`.

**Step 1**: User notices sync isn't running / MCP returns stale session error.
**Step 2**: User runs `npx whygraph sync`.
**Step 3**: Sync shows stale sessions, prompts to flush.
**Step 4**: User confirms. Sessions cleared. Sync processes accumulated staging.

### 12.3 Corrupted Last Line in events.jsonl

Process crashes during `fs.appendFile`.

**Step 1**: Next `loadEvents()` encounters malformed last line.
**Step 2**: Parser skips malformed trailing line.
**Step 3**: Graph is built from all valid events. The partial batch is lost.

⚠️ AMBIGUITY: If a batch had 5 events and only 3 were written before the crash, the graph has an incomplete batch. For example, a `node_added` for a decision exists but the `edge_added` AFFECTS is missing. This means a decision exists in the graph with no AFFECTS edge — orphaned. Should `loadEvents` detect and warn about orphaned nodes? Or is this an acceptable degraded state?

---

## Ambiguity Summary

New ambiguities found during simulation (to be added to OPEN_QUESTIONS.md):

1. **Init creates `staging.md` not `staging/`** — document inconsistency in DESIGN_DECISIONS.md step 6
2. **Platform-specific file paths and content** — Claude Code skill location, MCP config location, hook event type
3. **`sessions.json` creation** — who creates it? Init or first agent registration?
4. **Alias resolution across multiple staging files** — two-pass algorithm needed, collision handling for duplicate aliases
5. **`[deprecation]` staging entry type missing** — no way to stage DEPRECATES edges
6. **`[supersede]`, `[node-patch]`, `[edge-added]` staging entry types missing** — review resolution can't be staged
7. **Review dismissal mechanism** — no way to clear a review without creating a supersede
8. **MCP staleness logic with active sessions** — should not reject when sessions are active and staging exists (that's normal multi-agent state)
9. **Ref patch semantics** — `node_patched` for refs: full replacement or add/remove merge?
10. **Event timestamps** — sync time or capture time?
11. **Tag filtering on structural nodes** — what happens to nodes with no visible decisions?
12. **`get_history` scope** — direct AFFECTS only, or traverses COMPOSES downward?
13. **`get_gaps` ordering** — hierarchical, alphabetical, or arbitrary?
14. **MCP tools for reviews and errors** — should these be queryable via MCP?
15. **Browser opener** — cross-platform mechanism for opening viz
16. **Sync interactive prompting** — manual review resolution needs prompts during sync
17. **Config platform migration** — orphaned files from old platform
18. **Partial batch recovery** — orphaned nodes from incomplete writes
19. **Tag filter MCP: OR or AND** — matching semantics for multi-tag filter
