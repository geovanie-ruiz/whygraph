import graphology from "graphology";
import type { NodeLabel } from "../entity/types.js";

type MultiDirectedGraph = graphology.MultiDirectedGraph;

export interface NodeFilters {
  label?: NodeLabel;
  parent?: string;
  search?: string;
}

export interface NodeSummary {
  id: string;
  label: NodeLabel;
  name: string;
  parent?: string;
}

/**
 * List nodes with optional filtering. Returns lightweight summaries.
 * Excludes removed nodes.
 */
export function listNodes(
  graph: MultiDirectedGraph,
  filters?: NodeFilters,
): NodeSummary[] {
  const results: NodeSummary[] = [];

  graph.forEachNode((nodeId, attributes) => {
    // Exclude removed nodes
    if (attributes.removed_at) return;

    const label = attributes.label as NodeLabel;
    const name = (attributes.name ?? attributes.title) as string;
    const parent = attributes.parent as string | undefined;

    // Filter by label
    if (filters?.label && label !== filters.label) return;

    // Filter by parent
    if (filters?.parent && parent !== filters.parent) return;

    // Filter by search (case-insensitive substring on name/title)
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      if (!name.toLowerCase().includes(searchLower)) return;
    }

    const summary: NodeSummary = { id: nodeId, label, name };
    if (parent !== undefined) {
      summary.parent = parent;
    }
    results.push(summary);
  });

  return results;
}
