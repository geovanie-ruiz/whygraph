# Whygraph — Simulation Pass 9

Ninth simulation. Final sweep: dependency inventory, package.json consistency, self-contradiction scan, and one more adversarial pass.

---

## Angle 1: Complete Dependency Inventory

### Runtime Dependencies (from Tech Stack section)

| Package | Purpose | Used by |
|---------|---------|---------|
| `graphology` | In-memory graph data structure | Core (projection, query) |
| `graphology-traversal` | BFS/DFS traversal | Core (query, subgraph), MCP (context) |
| `commander` | CLI framework | CLI (init, sync, viz, config, mcp) |
| `prompts` | Interactive prompts | CLI (init guided flow, sync review resolution) |
| `@modelcontextprotocol/sdk` | MCP server | MCP (stdio server, tool registration) |
| `proper-lockfile` | Advisory file locking | Sync (.lock), session management (.sessions-lock) |
| `open` | Cross-platform browser opener | CLI (viz, init) |

### Dev Dependencies (from original spec, carried forward)

| Package | Purpose |
|---------|---------|
| `typescript` | Compiler |
| `@types/node` | Node.js type definitions |
| `vitest` | Test runner |

### Removed from Original Spec

| Package | Why removed |
|---------|-------------|
| `graphology-shortest-path` | No longer needed — `get_history` absorbed into `whygraph_context`, SUPERSEDES chain traversal uses BFS from `graphology-traversal` |
| `@typescript-eslint/*` + `eslint` | Not mentioned in design decisions. Linting is nice but not part of the design. Implementation can add it. |

**Checking**: Is `graphology-traversal` sufficient for all graph operations?

- BFS from a node: `bfsFromNode` ✅
- Find all nodes with a specific label: iterate `graph.forEachNode` ✅
- Find all edges of a type from a node: `graph.outEdges(nodeId)` + filter by label ✅
- COMPOSES traversal upward (parent chain): follow incoming COMPOSES edges ✅
- Recursive descendant collection: BFS over outgoing COMPOSES edges ✅

No algorithm requires shortest-path. ✅

### D3.js

D3.js v7 is not an npm dependency — it's embedded inline in the generated HTML. The viz bake command needs access to the D3 source to inline it. Options:
- Bundle D3's minified JS as a string constant in the TypeScript source
- Read D3 from `node_modules` at bake time (add `d3` as a dependency)
- Download D3 at build time and embed

If D3 is an npm dependency: `npm install d3` adds it. At bake time, read `node_modules/d3/dist/d3.min.js` and inline it. Simple.

If D3 is a bundled string constant: harder to update, but no runtime dependency.

⚠️ AMBIGUITY: How does the viz bake access D3.js for inlining? npm dependency read from node_modules, or bundled string constant?

---

## Angle 2: Self-Contradiction Scan

Reading through the design doc looking for any statements that contradict each other.

### "Four commands" (line 350) vs actual commands

The doc says "Four commands" then lists: init, sync, viz, config. Plus `mcp` as a subcommand. The changelog table says "4 commands (init, sync, viz, config) + `mcp` subcommand."

Is `mcp` a command or a subcommand? In `commander`, `whygraph mcp` would be a command like any other. The distinction is that `mcp` is never invoked by the user directly — it's spawned by the platform config.

Minor wording issue. Not an ambiguity — just clarify: "Five commands, one (`mcp`) invoked by platform config rather than the user." Or keep "four commands + mcp."

Not an ambiguity. ✅

### "Only write path" (line 165) vs init bootstrap

Line 165: "This is the only write path" (referring to staging).
Line 364: "Write App `node_added` event directly to `events.jsonl` (one-time bootstrap write path)"

Two write paths exist: staging (primary) and init bootstrap (one-time). This is documented and intentional. The "only write path" statement on line 165 should be qualified.

Minor wording. Not a design ambiguity. But could confuse an implementer.

### Decision `affects` property on node vs AFFECTS edges

We resolved that `process-staging` keeps them in sync via `node_patched`. The DecisionProperties interface (line 117) still has `affects: string[]`. This is correct — the property exists on the node and is kept in sync with edges. ✅

### `date` field: presentational vs DecisionProperties interface

Line 111: `date: string; // Presentational`
But `date` is listed as a required field in DecisionProperties. If `date` is optional in staging (derived from timestamp if absent), is it still required in the TypeScript interface?

The interface represents what's stored in events.jsonl. `process-staging` always populates `date` (either from the staging entry's `date:` field or derived from `timestamp`). So the event always has `date`. The interface is correct — `date` is required in the event, optional in staging. ✅

### Feature refs: "Features can have folder-level refs" (line 100)

But we resolved that `whygraph_context` uses exact file matching, and directory refs don't match file queries. Directory refs are informational only.

Is this consistent? Yes — the design says features CAN have folder-level refs. It doesn't say `whygraph_context` matches against them. The refs exist for the viz side panel display. ✅

---

## Angle 3: Final Adversarial Pass

### Agent writes staging entry for a file that matches two components

`src/shared/types.ts` is in refs of both `comp-types` and `comp-validation` (both components independently reference it).

Agent writes a decision with `files-touched: src/shared/types.ts`.

`process-staging` resolves to BOTH nodes. Emits two AFFECTS edges. Decision affects both. This is correct — the decision touches code in both components. ✅

### Agent writes staging entry with `supersedes` pointing to a non-Decision node

`supersedes: <uuid-of-a-component>`. Validation: `process-staging` checks that the UUID is a Decision node. This is not a Decision → error. Goes to errors.jsonl. ✅

### Agent writes `[deprecate]` with both UUIDs pointing to the same node

`[deprecate] <uuid-A> <uuid-A>`. A node deprecating itself. Structurally weird but not caught by any validation rule we've defined.

Should `process-staging` reject self-deprecation? Probably yes — it's meaningless.

But following our principle: whygraph is a mirror. If the agent said it, show it. The developer sees a self-referencing DEPRECATES edge and addresses it.

Consistent with our approach to cycles and double-supersedes. ✅ Allow it.

### Hook fires but whygraph isn't installed

User sets up a git hook via init, then removes the whygraph dependency from package.json (or switches branches where it's not installed). Git hook runs `npx whygraph sync`. `npx` can't find the package.

The hook fails silently or prints an error to stderr. No data corruption — staging files just accumulate. When whygraph is reinstalled, next sync processes everything.

Not a design gap — standard behavior for hook-based tooling. ✅

### Two agents write to the same session ID

Agent A registers as `session-abc`. Agent B, through a bug, also registers as `session-abc`. sessions.json shows one entry. When A deregisters, the entry is removed. B thinks it's still registered but sessions.json says empty. Sync fires while B is working.

This is a bug in session ID generation, not in the design. Session IDs should be unique (UUID-based). If they collide, it's a UUID collision — astronomically unlikely. ✅

### MCP server starts but events.jsonl doesn't exist

`whygraph mcp` is in the platform config, but `whygraph init` was never run. MCP server starts. `loadEvents()` tries to read a non-existent file.

Should return a clear error: "Whygraph not initialized. Run `whygraph init` first." All tool calls return this error.

⚠️ AMBIGUITY: MCP server behavior when whygraph isn't initialized (no `.whygraph/` directory or no `events.jsonl`). Should it refuse to start, or start and return errors on every tool call?

Starting and returning errors is more resilient — the MCP server doesn't crash the platform config. It just tells the agent to initialize.

---

## Summary

### Pass 9 Ambiguities Found

1. **D3.js inlining method** — npm dependency read from node_modules, or bundled string constant?
2. **MCP server without initialization** — start and return errors, or refuse to start?

### Observations (Not Ambiguities)

- `graphology-shortest-path` confirmed unnecessary
- D3 dependency needs clarification but is an implementation detail
- No self-contradictions found in the design doc (minor wording issues only)
- All adversarial inputs handled by existing validation or mirror principle
- "Only write path" on line 165 could be qualified but is documented elsewhere

**Two ambiguities. Both minor implementation details. Converging to zero.**
