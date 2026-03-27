import graphology from "graphology";
import type { DecisionNode, SymbolRef } from "../entity/types.js";

type MultiDirectedGraph = graphology.MultiDirectedGraph;

export interface ContextNodeResult {
  id: string;
  label: string;
  name: string;
  parentChain: string[];
}

export interface ContextResult {
  nodes: ContextNodeResult[];
  decisions: DecisionNode[];
}

function refMatches(
  refs: SymbolRef[],
  file: string,
  symbol?: string,
): boolean {
  for (const ref of refs) {
    if (ref.file !== file) continue;
    // File-level ref (no symbol) always matches
    if (ref.symbol === undefined) return true;
    // If no symbol filter requested, any file match counts
    if (symbol === undefined) return true;
    // Symbol must match
    if (ref.symbol === symbol) return true;
  }
  return false;
}

function getParentChain(graph: MultiDirectedGraph, nodeId: string): string[] {
  const chain: string[] = [];
  let current = nodeId;

  while (true) {
    // Find incoming COMPOSES edges (parent -> current)
    const inEdges = graph.inEdges(current);
    let foundParent = false;
    for (const edgeKey of inEdges) {
      if (graph.getEdgeAttribute(edgeKey, "label") === "COMPOSES") {
        const parent = graph.source(edgeKey);
        chain.push(parent);
        current = parent;
        foundParent = true;
        break;
      }
    }
    if (!foundParent) break;
  }

  return chain;
}

function collectDecisions(
  graph: MultiDirectedGraph,
  nodeIds: Set<string>,
): DecisionNode[] {
  const decisions = new Map<string, DecisionNode>();

  for (const nodeId of nodeIds) {
    // Find incoming AFFECTS edges (decision -> node)
    const inEdges = graph.inEdges(nodeId);
    for (const edgeKey of inEdges) {
      if (graph.getEdgeAttribute(edgeKey, "label") === "AFFECTS") {
        const decisionId = graph.source(edgeKey);
        /* v8 ignore next 1 */
        if (!decisions.has(decisionId)) {
          decisions.set(decisionId, {
            id: decisionId,
            ...graph.getNodeAttributes(decisionId),
          } as DecisionNode);
        }
      }
    }
  }

  return Array.from(decisions.values());
}

export function getContext(
  graph: MultiDirectedGraph,
  file: string,
  symbol?: string,
): ContextResult {
  const matchedNodes: ContextNodeResult[] = [];
  const allRelevantNodeIds = new Set<string>();

  graph.forEachNode((nodeId, attributes) => {
    const refs = attributes.refs as SymbolRef[] | undefined;
    if (!refs || refs.length === 0) return;

    if (!refMatches(refs, file, symbol)) return;

    const parentChain = getParentChain(graph, nodeId);

    matchedNodes.push({
      id: nodeId,
      label: attributes.label as string,
      name: attributes.name as string,
      parentChain,
    });

    // Collect this node and all ancestors for decision lookup
    allRelevantNodeIds.add(nodeId);
    for (const ancestorId of parentChain) {
      allRelevantNodeIds.add(ancestorId);
    }
  });

  const decisions = collectDecisions(graph, allRelevantNodeIds);

  return { nodes: matchedNodes, decisions };
}
