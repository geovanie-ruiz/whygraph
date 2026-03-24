import graphology from "graphology";
import { isStructuralNode, isDecisionNode } from "../entity/types.js";
import type { Entity } from "../entity/types.js";

type MultiDirectedGraph = graphology.MultiDirectedGraph;
const MultiDirectedGraph = graphology.MultiDirectedGraph;

export function buildGraph(entities: Entity[]): MultiDirectedGraph {
  const graph = new MultiDirectedGraph();

  // Phase 1: add all nodes
  for (const entity of entities) {
    const { id, ...attributes } = entity;
    graph.addNode(id, attributes);
  }

  // Phase 2: derive edges
  for (const entity of entities) {
    // COMPOSES: parent → child
    if (isStructuralNode(entity) && entity.parent !== undefined) {
      if (graph.hasNode(entity.parent)) {
        graph.addEdgeWithKey(
          `composes-${entity.parent}-${entity.id}`,
          entity.parent,
          entity.id,
          { label: "COMPOSES" },
        );
      } else {
        console.warn(
          `Skipping COMPOSES edge: parent "${entity.parent}" not found for node "${entity.id}"`,
        );
      }
    }

    // AFFECTS: decision → affected node
    if (isDecisionNode(entity)) {
      for (const targetId of entity.affects) {
        if (graph.hasNode(targetId)) {
          graph.addEdgeWithKey(
            `affects-${entity.id}-${targetId}`,
            entity.id,
            targetId,
            { label: "AFFECTS" },
          );
        } else {
          console.warn(
            `Skipping AFFECTS edge: target "${targetId}" not found for decision "${entity.id}"`,
          );
        }
      }

      // SUPERSEDES: new → old
      if (entity.supersedes !== undefined) {
        if (graph.hasNode(entity.supersedes)) {
          graph.addEdgeWithKey(
            `supersedes-${entity.id}-${entity.supersedes}`,
            entity.id,
            entity.supersedes,
            { label: "SUPERSEDES" },
          );
        } else {
          console.warn(
            `Skipping SUPERSEDES edge: target "${entity.supersedes}" not found for decision "${entity.id}"`,
          );
        }
      }
    }
  }

  return graph;
}
