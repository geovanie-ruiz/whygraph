import { isDecisionNode } from "../entity/types.js";
import type { Entity, DecisionNode } from "../entity/types.js";

export function searchDecisions(
  entities: Map<string, Entity>,
  query: string,
): DecisionNode[] {
  const lowerQuery = query.toLowerCase();
  const results: DecisionNode[] = [];

  for (const entity of entities.values()) {
    if (!isDecisionNode(entity)) continue;
    if (entity.removed_at !== undefined) continue;

    const searchable = [
      entity.title,
      entity.context,
      entity.decision,
      entity.tradeoffs,
      entity.alternatives,
    ];

    const matches = searchable.some(
      (field) => field.toLowerCase().includes(lowerQuery),
    );

    if (matches) {
      results.push(entity);
    }
  }

  return results;
}
