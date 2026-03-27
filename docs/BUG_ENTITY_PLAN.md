# Bug Entity Implementation Plan

## Overview

Add a `Bug` entity type to whygraph so a debugging agent can leverage the graph to triage failures, track fix attempts, and attribute blame to causal decisions.

## Entity Schema

```yaml
---
id: wg-xxxx
label: Bug
title: <short description>
status: open | in_progress | resolved | wont_fix
severity: low | medium | high | critical
manifests_in:
  - <component/feature/app ids>
caused_by:
  - <decision ids>
root_cause: <text, populated once known>
attempts:
  - id: 1
    hypothesis: "ETag cache eviction clears auth tokens"
    pr: "https://github.com/org/repo/pull/42"
    pr_status: open | merged | closed
    outcome: pending | failed | succeeded
    notes: "tokens still expiring after merge"
    date: "2026-03-26"
refs:
  - file: src/auth/token.ts
    symbol: validateToken
created_at: <ISO 8601>
updated_at: <ISO 8601>
---

Free-form description of the bug (markdown body)
```

## New Edge Types

| Edge | Direction | Meaning |
|------|-----------|---------|
| `MANIFESTS_IN` | Bug -> Structural node | Bug appeared in this component |
| `CAUSED_BY` | Bug -> Decision | This decision is to blame |

Blame lives on Bug, not Decision. Decisions are immutable ADRs; blame is a derived reverse-edge view.

## Agent Loop Model

1. Agent observes failure -> calls `whygraph_context(file)` to get component + decisions
2. Calls `whygraph_get_bugs(component)` to check prior bugs and their root causes
3. Creates bug with `whygraph_create_bug()`
4. Forms hypothesis -> creates attempt with `whygraph_create_attempt()`
5. Opens PR, waits for merge
6. Re-runs failing scenario
7. If passes: `whygraph_update_attempt(..., outcome: succeeded)` + `whygraph_resolve_bug()`
8. If fails: `whygraph_update_attempt(..., outcome: failed)` + back to step 4

---

## Phase 1 - Entity Layer

Unblocks everything else. Highest-risk change is the `isStructuralNode` guard fix.

### 1.1 `src/entity/types.ts`

- Add `BugStatus`, `BugSeverity`, `PrStatus`, `AttemptOutcome`, `BugAttempt`, `BugNode` interfaces
- Expand `Entity` union to three members: `StructuralNode | DecisionNode | BugNode`
- Add `isBugNode()` type guard
- Change `isStructuralNode` from negative guard (`!== "Decision"`) to affirmative set check so `Bug` nodes don't pass through as structural nodes

### 1.2 `src/entity/parser.ts`

- Add `parseBugNode(data, body)` following existing parse patterns
- Dispatch on `label === "Bug"` in `parseEntity`
- Attempts array lives in YAML frontmatter; body becomes `description`

### 1.3 `src/entity/validate.ts`

- Add `"Bug"` to `VALID_LABELS`
- Add Bug validation block: title, status, severity, manifests_in required
- Add cross-ref validation for `manifests_in` and `caused_by` targets

### 1.4 `src/entity/writer.ts`

- Add `renderBugFrontMatter()` and `renderBugBody()`
- Update `renderEntity` dispatch and `titleOrName` helper for `BugNode`

### Tests

- Parse: minimal valid Bug, optional fields, null on missing required fields, attempts array, body->description
- Validate: valid minimal passes, invalid status/severity fails, empty manifests_in fails, malformed attempt fails
- Writer: roundtrip parse->render produces identical object

---

## Phase 2 - Graph Layer

Derives the two new edge types and extends `getContext`.

### 2.1 `src/graph/projection.ts`

- Add `MANIFESTS_IN` and `CAUSED_BY` edge construction in the Phase 2 edges loop
- Log warnings for missing targets

### 2.2 `src/graph/bugs.ts` (new file)

- `getBugs(graph, filters)` with `status`, `severity`, `component`, `decision` filters
- Component/decision filters traverse graph edges rather than scanning arrays

### 2.3 `src/graph/query.ts`

- Add `bugs: BugNode[]` to `ContextResult`
- Implement `collectBugs()` via in-edges on matched nodes
- Call it in `getContext`

### Tests

- Edge construction for MANIFESTS_IN and CAUSED_BY
- Filter behavior per dimension
- Context result includes bugs for matched structural nodes

---

## Phase 3 - GraphQL Schema & Resolvers

### 3.1 `src/server/schema.ts`

**Types:** `BugNode`, `BugAttempt`, `BugAttemptInput`

**Union:** `Entity = StructuralNode | DecisionNode | BugNode` with `__resolveType` update

**Query:** `bugs(status, component, decision, severity): [BugNode!]!`

**Mutations:**

| Mutation | Purpose |
|----------|---------|
| `createBug(title, manifests_in[], severity, ...)` | Create a bug, status: open |
| `createAttempt(bug_id, hypothesis, pr?, date)` | Append attempt, set bug to in_progress |
| `updateAttempt(bug_id, attempt_id, outcome, notes?, pr_status?)` | Mark attempt failed/succeeded |
| `resolveBug(bug_id, root_cause)` | Set status to resolved |

**ContextResult:** Extend with `bugs` field

### Tests

- Integration tests per query/mutation using temp dir + real HTTP

---

## Phase 4 - MCP Tools

### Read tools

- `whygraph_get_bugs(status?, component?, decision?, severity?)` -> Bug[]
- Extend `whygraph_context` response to include `bugs[]`

### Write tools (strict mode)

- `whygraph_create_bug` — fallback: write to disk if server unreachable
- `whygraph_create_attempt` — no fallback, requires server
- `whygraph_update_attempt` — no fallback, requires server
- `whygraph_resolve_bug` — no fallback, requires server

### Tests

- Mock fetch, verify correct GQL variables per tool
- Fallback disk-write for createBug

---

## Phase 5 - CLI Commands

### 5.1 `src/cli/commands/bugs.ts` (new file)

- `whygraph bugs [--status] [--component] [--json]` — list bugs
- `whygraph bug <id>` — show single bug detail with attempts table

### 5.2 `src/cli/index.ts`

- Register new commands

### Tests

- Correct GQL query construction
- Output formatting for non-JSON and JSON modes

---

## Decision Points

1. **`isStructuralNode` guard** — change to affirmative set check (confirmed)
2. **Attempt ID numbering** — `attempts.length + 1` vs `max(existing ids) + 1`
3. **Attempt/update/resolve fallback** — plan surfaces error when server unreachable (no disk fallback)
4. **`getContext` bug scope** — includes ancestor node matches (same as decisions)
5. **`bugCount` in `ServerStatus`** — one-line addition, included or deferred

## File Change Manifest

| File | Type | Phase |
|------|------|-------|
| `src/entity/types.ts` | Modify | 1 |
| `src/entity/parser.ts` | Modify | 1 |
| `src/entity/validate.ts` | Modify | 1 |
| `src/entity/writer.ts` | Modify | 1 |
| `src/graph/projection.ts` | Modify | 2 |
| `src/graph/bugs.ts` | Create | 2 |
| `src/graph/query.ts` | Modify | 2 |
| `src/server/schema.ts` | Modify | 3 |
| `src/mcp/server.ts` | Modify | 4 |
| `src/cli/commands/bugs.ts` | Create | 5 |
| `src/cli/index.ts` | Modify | 5 |
