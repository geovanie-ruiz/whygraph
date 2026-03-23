## [decision] Allow affects in node_patched validation

timestamp: 2026-03-23T09:28:00.000Z
context: The cascade removal logic needs to emit node_patched events that update a decision's affects array when some (but not all) affected nodes are removed. The validator previously forbade patching affects, treating it as edge-managed.
decision: Removed affects from PATCH_FORBIDDEN and added it to KNOWN_PATCHABLE in validate.ts. The cascade processor is the only producer of affects patches, so the semantic integrity is maintained by the processor itself.
tradeoffs: Gained the ability to partially update decision affects during cascade removal. Lost the validator-level guard that prevented arbitrary affects modification — now any node_patched event can modify affects, not just cascade-generated ones.
alternatives: Could have skipped validation for cascade-generated events entirely, but that would weaken the overall validation guarantee. Could have added a flag to bypass specific forbidden fields per-event, but that adds complexity for a single use case.
affects: 8369c4de-aa78-425e-9bed-bf946e27efa6, 214d01a5-c6b8-4a26-aa6a-c90451f6dd12
tags: arch

## [decision] Cascade function returns all removed node IDs alongside events

timestamp: 2026-03-23T09:29:00.000Z
context: The autoDismissForNodes function needs to know ALL removed node IDs (root, descendants, and orphaned decisions) to properly dismiss reviews. Previously, only the directly-requested root node IDs were passed, missing cascade-removed nodes.
decision: Changed collectCascadeRemovals to return a CascadeResult struct with both events and allRemovedNodeIds. The caller uses allRemovedNodeIds for review auto-dismissal, ensuring reviews referencing any cascade-removed node (including orphaned decisions) are dismissed.
tradeoffs: Gained complete review cleanup coverage. The return type is slightly more complex (struct vs plain array), but the struct is private to the module and self-documenting.
alternatives: Could have extracted removed node IDs from the cascade events by filtering for node_removed event types, but that couples the dismissal logic to event structure and would miss edge cases if event generation changes.
affects: 214d01a5-c6b8-4a26-aa6a-c90451f6dd12, 27d2d68c-387a-4e04-8d81-53c6c333e65b
tags: data

## [decision] BFS with depth tracking for leaf-first node removal ordering

timestamp: 2026-03-23T09:30:00.000Z
context: The spec requires node_removed events in children-first, parent-last order. The original DFS-based Set iteration produced nodes in traversal order (parent first), which is the opposite of what's needed. Additionally, the root node_removed was emitted by entriesToEvents before cascade events.
decision: Switched to BFS with a depth map, then sort nodes by descending depth for removal. The root node_removed is now included in cascade output (not in entriesToEvents), and doProcess strips root node_removed from validEvents when cascade handles it. Events are assembled in strict order: node_patched, edge_removed, node_removed.
tradeoffs: Gained correct event ordering that matches the spec and ensures graph projection can apply events without dangling references. The BFS + sort approach is O(n log n) vs the previous O(n) iteration, but n is bounded by graph size which is small.
alternatives: Could have used DFS post-order traversal to get leaf-first ordering directly, but BFS with explicit depth is easier to reason about and debug. Could have kept root node_removed in entriesToEvents and reordered at the end, but splitting the responsibility makes the ordering harder to verify.
affects: 214d01a5-c6b8-4a26-aa6a-c90451f6dd12
tags: arch
