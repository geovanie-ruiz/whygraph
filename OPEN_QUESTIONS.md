# Open Questions

Items that surfaced during work and need follow-up.

## Missing guard for duplicate `edge_added` keys in projection

**Found:** 2026-03-22, during sub-agent decision capture experiment (Run D)

**Problem:** `replayEvent` in `src/core/projection.ts` checks that endpoint nodes
exist before calling `graph.addEdgeWithKey()`, but does NOT check whether an edge
with the same key already exists. `MultiDirectedGraph.addEdgeWithKey()` throws if
the key is already in use. This violates the module's contract: "skip invalid event
sequences with `console.error` warning (do not throw)."

**Reproduction:** Replay an event sequence containing two `edge_added` events with
the same `id`. The second one will throw instead of being skipped.

**Impact:** Any corrupted or replayed event log with duplicate edge IDs will cause
`buildGraph()` to throw, breaking CLI and MCP callers that expect a partial graph.

**Suggested fix:** Add a `graph.hasEdge(event.id)` guard before `addEdgeWithKey`,
matching the pattern used for `node_added` (which already guards against duplicates).

**Status:** Open — needs a bead created when we work on projection for real.
