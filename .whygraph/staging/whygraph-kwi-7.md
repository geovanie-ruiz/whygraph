## [decision] Resolver uses discriminated union return with error accumulation
timestamp: 2026-03-23T12:00:00Z
context: The resolver must process a batch of staging entries where some may fail to resolve while others succeed. Need to decide between throwing on first error vs accumulating errors.
decision: resolveEntries returns a ResolveResult with separate resolved[] and errors[] arrays. Failed entries are skipped (not added to resolved) and their error is recorded. This lets the caller process valid entries while reporting all problems.
tradeoffs: Callers must check both arrays — slightly more complex API. But the alternative (throwing) would abort the entire batch on one bad reference, losing all valid work.
alternatives: Throw on first error (rejected: loses valid entries). Return entries with null IDs for failures (rejected: pushes error handling to every consumer). Result type with ok/err per entry (rejected: over-engineered for the current need).
affects: cbd9e7bb-21ee-4fe5-926b-ed8f78c8198f
tags: arch, data

## [decision] Four-tier reference resolution order: alias, app, UUID, file-path
timestamp: 2026-03-23T12:01:00Z
context: A reference string in a staging entry could be an alias, the literal "app", a UUID, or a file path. Need a deterministic resolution order.
decision: resolveRef checks in order: (1) alias map, (2) "app" literal, (3) UUID regex match, (4) file-path ref lookup in graph. First match wins.
tradeoffs: An alias named "app" would shadow the built-in app resolution — but "app" is a reserved word in practice. A UUID-formatted alias would be treated as UUID first, but aliases should be human-readable names, not UUIDs.
alternatives: Require prefixes like @alias or $app (rejected: adds syntax overhead to the staging format). Check graph existence for UUIDs before accepting (rejected: new nodes created in the same batch won't be in the graph yet).
affects: cbd9e7bb-21ee-4fe5-926b-ed8f78c8198f
tags: arch

## [decision] File-scoped alias map reset per resolveEntries call
timestamp: 2026-03-23T12:02:00Z
context: Aliases allow entries within a staging file to reference each other by short name. Need to decide alias scope boundaries.
decision: The alias map is created fresh in each resolveEntries call and not persisted. Aliases defined in one call are invisible to other calls. This enforces file-scoped isolation since each staging file is parsed and resolved independently.
tradeoffs: Cannot reference aliases across staging files. But cross-file aliases would create implicit ordering dependencies between files, making the system fragile.
alternatives: Global alias registry persisted across calls (rejected: creates ordering dependencies). Alias resolution as a separate pre-pass (rejected: unnecessary complexity when single-pass works).
affects: cbd9e7bb-21ee-4fe5-926b-ed8f78c8198f
tags: arch

## [decision] Accept UUID-format references without graph existence check
timestamp: 2026-03-23T12:03:00Z
context: When resolveRef encounters a UUID-format string, it could validate that the node exists in the graph or accept it on format alone.
decision: UUID-format strings are accepted without requiring the node to exist in the graph. This is necessary because a new node created earlier in the same batch (e.g., a feature) assigns a UUID that won't be in the graph until events are emitted.
tradeoffs: A typo in a UUID will not be caught at resolve time — it will only fail at event emission or projection. But requiring graph existence would break the common pattern of creating a node and immediately referencing it.
alternatives: Two-pass resolution where new nodes are added to a virtual graph first (rejected: duplicates projection logic). Require aliases for all intra-batch references (rejected: UUIDs from the existing graph should work directly).
affects: cbd9e7bb-21ee-4fe5-926b-ed8f78c8198f
tags: data
