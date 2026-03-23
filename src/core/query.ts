import type { MultiDirectedGraph } from "graphology";
import type {
  ContextResult,
  DecisionProperties,
  DecisionStatus,
  DecisionTag,
  GraphNodeAttributes,
  NodeLabel,
  SymbolRef,
} from "./types.js";

// ── Types ────────────────────────────────────────────────────

export interface DecisionFilters {
  status?: DecisionStatus;
  tags?: DecisionTag[];
  after?: string;
  before?: string;
}

export interface GapNode {
  id: string;
  label: NodeLabel;
  name: string;
}

// ── getContext ────────────────────────────────────────────────

/**
 * Find nodes matching a file path (and optionally symbol), traverse
 * COMPOSES upward for parent chains, and collect AFFECTS decisions.
 *
 * When symbol is provided, a node matches if:
 *   - its ref has the file AND no symbol (file-level ref), OR
 *   - its ref has the file AND the same symbol
 *
 * Returns null if no nodes match the file.
 */
export function getContext(
  graph: MultiDirectedGraph,
  file: string,
  symbol?: string
): ContextResult | null {
  // Find all nodes whose refs match the file (and optionally symbol)
  const matchedNodes: Array<{
    id: string;
    label: NodeLabel;
    name: string;
    parentChain: string[];
  }> = [];

  graph.forEachNode((nodeId, attrs) => {
    const refs = (attrs as GraphNodeAttributes).refs as
      | SymbolRef[]
      | undefined;
    if (!refs || refs.length === 0) return;

    const matches = refs.some((ref) => {
      if (ref.file !== file) return false;
      if (symbol === undefined) return true;
      // When symbol is provided: match if ref has no symbol (file-level) or same symbol
      return ref.symbol === undefined || ref.symbol === symbol;
    });

    if (!matches) return;

    const parentChain = getParentChain(graph, nodeId);
    matchedNodes.push({
      id: nodeId,
      label: (attrs as GraphNodeAttributes).label,
      name: (attrs as GraphNodeAttributes).name,
      parentChain,
    });
  });

  if (matchedNodes.length === 0) return null;

  // Collect all unique node IDs (matched + parent chains)
  const relevantNodeIds = new Set<string>();
  for (const node of matchedNodes) {
    relevantNodeIds.add(node.id);
    for (const parentId of node.parentChain) {
      relevantNodeIds.add(parentId);
    }
  }

  // Find all Decision nodes with AFFECTS edges pointing to relevant nodes
  const decisionMap = new Map<string, DecisionProperties>();
  graph.forEachNode((nodeId, attrs) => {
    if ((attrs as GraphNodeAttributes).label !== "Decision") return;

    // Check if this decision has an AFFECTS edge to any relevant node
    const hasAffects = graph.someOutEdge(nodeId, (_edge, edgeAttrs) => {
      if (edgeAttrs.label !== "AFFECTS") return false;
      const target = graph.target(_edge);
      return relevantNodeIds.has(target);
    });

    if (hasAffects) {
      decisionMap.set(nodeId, attrs as unknown as DecisionProperties);
    }
  });

  return {
    nodes: matchedNodes,
    decisions: Array.from(decisionMap.entries()).map(([id, attributes]) => ({
      id,
      attributes,
    })),
  };
}

// ── getDecisions ─────────────────────────────────────────────

/**
 * Filter Decision nodes by status, tags, and date range.
 * - status: AND filter
 * - tags: OR filter (matches if decision has ANY of the given tags)
 * - after/before: AND filter on the date property (inclusive comparison)
 *
 * Returns array of decision node IDs.
 */
export function getDecisions(
  graph: MultiDirectedGraph,
  filters: DecisionFilters
): string[] {
  const result: string[] = [];

  graph.forEachNode((nodeId, attrs) => {
    if ((attrs as GraphNodeAttributes).label !== "Decision") return;

    const decAttrs = attrs as unknown as DecisionProperties;

    // Status filter (AND)
    if (filters.status !== undefined && decAttrs.status !== filters.status) {
      return;
    }

    // Tags filter (OR — decision must have at least one of the given tags)
    if (filters.tags !== undefined && filters.tags.length > 0) {
      const decTags = decAttrs.tags || [];
      const hasAny = filters.tags.some((t) => decTags.includes(t));
      if (!hasAny) return;
    }

    // Date filters (AND, inclusive)
    if (filters.after !== undefined && decAttrs.date < filters.after) {
      return;
    }
    if (filters.before !== undefined && decAttrs.date > filters.before) {
      return;
    }

    result.push(nodeId);
  });

  return result;
}

// ── getGaps ──────────────────────────────────────────────────

/**
 * Find Feature and Component nodes that have no inbound AFFECTS edges
 * (no decisions recorded for them).
 *
 * Order: Features first, then top-level components (direct children of features),
 * then deeper components. Respects optional limit.
 */
export function getGaps(
  graph: MultiDirectedGraph,
  limit?: number
): GapNode[] {
  const features: GapNode[] = [];
  const topComponents: GapNode[] = [];
  const deepComponents: GapNode[] = [];

  graph.forEachNode((nodeId, attrs) => {
    const label = (attrs as GraphNodeAttributes).label;
    if (label !== "Feature" && label !== "Component") return;

    // Check for inbound AFFECTS edges
    let hasInboundAffects = false;
    graph.forEachInEdge(nodeId, (_edge, edgeAttrs) => {
      if (edgeAttrs.label === "AFFECTS") {
        hasInboundAffects = true;
      }
    });

    if (hasInboundAffects) return;

    const node: GapNode = {
      id: nodeId,
      label,
      name: (attrs as GraphNodeAttributes).name,
    };

    if (label === "Feature") {
      features.push(node);
    } else {
      // Determine depth: check if parent is a Feature (top-level) or Component (deeper)
      const depth = getComponentDepth(graph, nodeId);
      if (depth <= 1) {
        topComponents.push(node);
      } else {
        deepComponents.push(node);
      }
    }
  });

  const all = [...features, ...topComponents, ...deepComponents];
  return limit !== undefined ? all.slice(0, limit) : all;
}

// ── getNodeAttributes ────────────────────────────────────────

/**
 * Return full attributes for a node, or null if not found.
 */
export function getNodeAttributes(
  graph: MultiDirectedGraph,
  nodeId: string
): Record<string, unknown> | null {
  if (!graph.hasNode(nodeId)) return null;
  return graph.getNodeAttributes(nodeId) as Record<string, unknown>;
}

// ── getFeatureIds ────────────────────────────────────────────

/**
 * Return all Feature node IDs.
 */
export function getFeatureIds(graph: MultiDirectedGraph): string[] {
  const result: string[] = [];
  graph.forEachNode((nodeId, attrs) => {
    if ((attrs as GraphNodeAttributes).label === "Feature") {
      result.push(nodeId);
    }
  });
  return result;
}

// ── Internal helpers ─────────────────────────────────────────

/**
 * Walk COMPOSES edges upward from a node to build its parent chain.
 * COMPOSES edges go from parent -> child, so we follow inbound COMPOSES edges.
 */
function getParentChain(graph: MultiDirectedGraph, nodeId: string): string[] {
  const chain: string[] = [];
  let current = nodeId;

  while (true) {
    let parentId: string | null = null;
    graph.forEachInEdge(current, (edge, edgeAttrs) => {
      if (edgeAttrs.label === "COMPOSES" && parentId === null) {
        parentId = graph.source(edge);
      }
    });

    if (parentId === null) break;
    chain.push(parentId);
    current = parentId;
  }

  return chain;
}

/**
 * Get the depth of a component in the COMPOSES hierarchy.
 * Depth 1 = direct child of a Feature. Depth 2+ = nested deeper.
 */
function getComponentDepth(
  graph: MultiDirectedGraph,
  nodeId: string
): number {
  let depth = 0;
  let current = nodeId;

  while (true) {
    let parentId: string | null = null;
    graph.forEachInEdge(current, (edge, edgeAttrs) => {
      if (edgeAttrs.label === "COMPOSES" && parentId === null) {
        parentId = graph.source(edge);
      }
    });

    if (parentId === null) break;
    depth++;
    const parentLabel = (
      graph.getNodeAttributes(parentId) as GraphNodeAttributes
    ).label;
    if (parentLabel === "Feature" || parentLabel === "App") break;
    current = parentId;
  }

  return depth;
}
