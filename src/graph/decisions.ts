import graphology from "graphology";
import type { DecisionNode, DecisionStatus, DecisionTag } from "../entity/types.js";

type MultiDirectedGraph = graphology.MultiDirectedGraph;

export interface DecisionFilters {
  status?: DecisionStatus;
  tags?: DecisionTag[];
  dateFrom?: string;
  dateTo?: string;
}

export function getDecisions(
  graph: MultiDirectedGraph,
  filters?: DecisionFilters,
): DecisionNode[] {
  const results: DecisionNode[] = [];

  graph.forEachNode((nodeId, attributes) => {
    if (attributes.label !== "Decision") return;

    // Exclude removed decisions
    if (attributes.removed_at !== undefined) return;

    // Status filter (AND)
    if (filters?.status !== undefined && attributes.status !== filters.status) return;

    // Tags filter (OR within tags)
    if (filters?.tags !== undefined && filters.tags.length > 0) {
      const nodeTags = attributes.tags as DecisionTag[];
      const hasMatch = filters.tags.some((tag) => nodeTags.includes(tag));
      if (!hasMatch) return;
    }

    // Date range filters (AND)
    if (filters?.dateFrom !== undefined && attributes.date < filters.dateFrom) return;
    if (filters?.dateTo !== undefined && attributes.date > filters.dateTo) return;

    results.push({ id: nodeId, ...attributes } as DecisionNode);
  });

  return results;
}
