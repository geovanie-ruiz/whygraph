import { isDecisionNode } from "../entity/types.js";
import type { Entity, DecisionNode } from "../entity/types.js";

export interface SupersedeCandidate {
  newDecisionId: string;
  existingDecisionId: string;
  sharedNodeIds: string[];
}

export function detectSupersedeCandidates(
  entities: Map<string, Entity>,
): SupersedeCandidate[] {
  // Collect active, non-removed decisions
  const activeDecisions: DecisionNode[] = [];
  for (const entity of entities.values()) {
    if (!isDecisionNode(entity)) continue;
    if (entity.removed_at !== undefined) continue;
    if (entity.status === "superseded") continue;
    activeDecisions.push(entity);
  }

  // Build a set of existing supersedes relationships for exclusion
  const supersededPairs = new Set<string>();
  for (const entity of entities.values()) {
    if (!isDecisionNode(entity)) continue;
    if (entity.supersedes !== undefined) {
      // Normalize as "newer->older"
      supersededPairs.add(`${entity.id}->${entity.supersedes}`);
    }
  }

  const candidates: SupersedeCandidate[] = [];

  for (let i = 0; i < activeDecisions.length; i++) {
    for (let j = i + 1; j < activeDecisions.length; j++) {
      const a = activeDecisions[i];
      const b = activeDecisions[j];

      // Check if already in a supersedes relationship (either direction)
      if (
        supersededPairs.has(`${a.id}->${b.id}`) ||
        supersededPairs.has(`${b.id}->${a.id}`)
      ) {
        continue;
      }

      const aSet = new Set(a.affects);
      const shared = b.affects.filter((id) => aSet.has(id));

      if (shared.length > 0) {
        // Newer decision (later date or later created_at) is "new", other is "existing"
        const aIsNewer = a.created_at > b.created_at;
        candidates.push({
          newDecisionId: aIsNewer ? a.id : b.id,
          existingDecisionId: aIsNewer ? b.id : a.id,
          sharedNodeIds: shared,
        });
      }
    }
  }

  return candidates;
}
