import graphology from "graphology";
import { buildGraph } from "./projection.js";
import { isDecisionNode, isStructuralNode } from "../entity/types.js";
import type { Entity } from "../entity/types.js";

type MultiDirectedGraph = graphology.MultiDirectedGraph;
const MultiDirectedGraph = graphology.MultiDirectedGraph;

export interface CascadeResult {
  removedIds: string[];
  orphanedDecisionIds: string[];
  partialDecisionPatches: Array<{ id: string; remainingAffects: string[] }>;
}

export function cascadeRemoval(
  entities: Map<string, Entity>,
  nodeId: string,
  timestamp: string,
): CascadeResult {
  const entityArray = Array.from(entities.values());
  const graph = buildGraph(entityArray);

  // Collect all descendants via COMPOSES edges (recursive)
  const removalSet = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.pop()!;
    /* v8 ignore next 1 */
    if (removalSet.has(current)) continue;
    if (!graph.hasNode(current)) continue;
    removalSet.add(current);

    // Find COMPOSES children: edges where current is source with label COMPOSES
    graph.forEachOutEdge(current, (_edge, attrs, _source, target) => {
      if (attrs.label === "COMPOSES" && !removalSet.has(target)) {
        queue.push(target);
      }
    });
  }

  const removedIds = Array.from(removalSet);
  const orphanedDecisionIds: string[] = [];
  const partialDecisionPatches: Array<{
    id: string;
    remainingAffects: string[];
  }> = [];

  // Check all decisions
  for (const entity of entityArray) {
    if (!isDecisionNode(entity)) continue;
    if (entity.removed_at !== undefined) continue;
    if (removalSet.has(entity.id)) continue;

    const affectsInRemoval = entity.affects.filter((id) => removalSet.has(id));
    if (affectsInRemoval.length === 0) continue;

    const remaining = entity.affects.filter((id) => !removalSet.has(id));
    if (remaining.length === 0) {
      orphanedDecisionIds.push(entity.id);
    } else {
      partialDecisionPatches.push({ id: entity.id, remainingAffects: remaining });
    }
  }

  return { removedIds, orphanedDecisionIds, partialDecisionPatches };
}
