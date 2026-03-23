## [decision] Pure functions taking graph as first argument
context: The query layer needs access to the projected graph. Could inject it via class, closure, or pass explicitly.
decision: All query functions are pure — they take a MultiDirectedGraph as the first argument and return results with no side effects.
tradeoffs: Slightly more verbose call sites, but enables trivial testing (pass any graph) and no hidden state.
alternatives: A Query class wrapping the graph; module-level singleton; dependency injection container.
affects: 9a3675d7-3c0d-4849-825d-2835cf73e912
tags: arch

## [decision] Symbol matching semantics in getContext
context: When getContext receives both file and symbol, we need rules for which refs match. A ref might have file only, or file+symbol.
decision: A ref matches if (1) file matches AND ref has no symbol (file-level ref always matches), or (2) file matches AND symbol matches. This means a file-level ref is a broad match, while a symbol-specific ref is narrow.
tradeoffs: A file-level ref matches even when a specific symbol is requested, which could return extra nodes. But omitting file-level matches would hide relevant context.
alternatives: Strict match requiring exact symbol; ignore symbol parameter entirely; require all refs to have symbols.
affects: 9a3675d7-3c0d-4849-825d-2835cf73e912
tags: data

## [decision] Collect decisions from matched nodes and their parent chains
context: getContext must decide which decisions are relevant. Decisions could be collected from only the matched nodes, or from the full ancestor hierarchy.
decision: Relevant decisions are those with AFFECTS edges pointing to any node in the set of matched nodes PLUS all nodes in their parent chains. This captures both local and inherited architectural context.
tradeoffs: May surface decisions that feel tangential (e.g., a decision on a parent feature). But missing inherited constraints is worse — a junior might violate a feature-level decision while working on a child component.
alternatives: Only collect from matched nodes; walk the entire subtree downward as well; let callers specify depth.
affects: 9a3675d7-3c0d-4849-825d-2835cf73e912
tags: arch

## [decision] getGaps excludes App and Decision nodes
context: getGaps finds nodes without inbound AFFECTS edges. App nodes never have AFFECTS edges (they are structural roots). Decision nodes are the source of AFFECTS, not targets.
decision: Only Feature and Component nodes are considered for gaps. App and Decision nodes are filtered out.
tradeoffs: If someone adds a new node label, they must update getGaps. But including App/Decision would produce meaningless noise.
alternatives: Include all node types; accept a label filter parameter.
affects: 9a3675d7-3c0d-4849-825d-2835cf73e912
tags: arch

## [decision] Hierarchical gap ordering by label then COMPOSES depth
context: getGaps returns nodes ordered by importance. Features represent larger architectural gaps than deeply nested components.
decision: Order is: Features first, then top-level Components (direct children of Features via COMPOSES), then deeper Components. Within each tier, order is graph iteration order.
tradeoffs: Does not sort alphabetically or by creation date within tiers. Graph iteration order is stable but not user-controllable.
alternatives: Sort by name; sort by number of descendants; flat alphabetical; let caller sort.
affects: 9a3675d7-3c0d-4849-825d-2835cf73e912
tags: data

## [decision] Date comparison uses string ordering on ISO dates
context: getDecisions filters by after/before on the date property. Dates are stored as ISO strings (YYYY-MM-DD).
decision: Use direct string comparison (< and >) for date filtering. This works because ISO 8601 date strings sort lexicographically.
tradeoffs: Breaks if dates are stored in non-ISO formats. But the type system enforces ISO strings via DecisionProperties.date.
alternatives: Parse to Date objects; use a date library; store as epoch milliseconds.
affects: 9a3675d7-3c0d-4849-825d-2835cf73e912
tags: data
