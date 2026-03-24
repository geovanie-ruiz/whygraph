import graphology from "graphology";
import type { StructuralNode } from "../entity/types.js";

type MultiDirectedGraph = graphology.MultiDirectedGraph;

/**
 * Find Feature/Component nodes with no inbound AFFECTS edges from any Decision.
 * Order: Features first, then Components by COMPOSES depth (shallow first).
 * Excludes removed nodes and App nodes.
 */
export function getGaps(
  graph: MultiDirectedGraph,
  limit?: number,
): StructuralNode[] {
  const gaps: StructuralNode[] = [];

  graph.forEachNode((nodeId, attributes) => {
    // Skip removed nodes
    if (attributes.removed_at) return;

    // Only Feature and Component nodes
    const label = attributes.label as string;
    if (label !== "Feature" && label !== "Component") return;

    // Check for inbound AFFECTS edges
    const hasAffects = graph.someInEdge(nodeId, (_edge, edgeAttrs) => {
      return edgeAttrs.label === "AFFECTS";
    });

    if (!hasAffects) {
      gaps.push({ id: nodeId, ...attributes } as unknown as StructuralNode);
    }
  });

  // Sort: Features first, then Components by COMPOSES depth (shallow first)
  gaps.sort((a, b) => {
    if (a.label !== b.label) {
      return a.label === "Feature" ? -1 : 1;
    }
    if (a.label === "Component" && b.label === "Component") {
      const depthA = getComposesDepth(graph, a.id);
      const depthB = getComposesDepth(graph, b.id);
      return depthA - depthB;
    }
    return 0;
  });

  if (limit !== undefined) {
    return gaps.slice(0, limit);
  }

  return gaps;
}

/** Count how many COMPOSES edges exist from root to this node. */
function getComposesDepth(graph: MultiDirectedGraph, nodeId: string): number {
  let depth = 0;
  let current = nodeId;

  while (true) {
    let parentFound: string | null = null;
    graph.forEachInEdge(current, (_edge, edgeAttrs, source) => {
      if (edgeAttrs.label === "COMPOSES") {
        parentFound = source;
      }
    });

    if (parentFound === null) break;
    depth++;
    current = parentFound;
  }

  return depth;
}
