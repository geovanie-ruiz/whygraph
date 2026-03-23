import { MultiDirectedGraph } from "graphology";
import type {
  WhyEvent,
  NodeAddedEvent,
  EdgeAddedEvent,
  NodePatchedEvent,
  EdgeRemovedEvent,
  NodeRemovedEvent,
} from "./types.js";

/**
 * Apply a single event to the graph, catching and logging errors
 * for invalid sequences rather than throwing.
 */
function applyEvent(graph: MultiDirectedGraph, event: WhyEvent): void {
  switch (event.type) {
    case "node_added": {
      const e = event as NodeAddedEvent;
      if (graph.hasNode(e.id)) {
        console.error(
          `Skipping duplicate node_added for "${e.id}" at ${e.timestamp}`
        );
        return;
      }
      graph.addNode(e.id, { label: e.label, ...e.properties });
      break;
    }
    case "edge_added": {
      const e = event as EdgeAddedEvent;
      if (!graph.hasNode(e.from)) {
        console.error(
          `Skipping edge_added "${e.id}": source node "${e.from}" does not exist`
        );
        return;
      }
      if (!graph.hasNode(e.to)) {
        console.error(
          `Skipping edge_added "${e.id}": target node "${e.to}" does not exist`
        );
        return;
      }
      if (graph.hasEdge(e.id)) {
        console.error(
          `Skipping duplicate edge_added for "${e.id}" at ${e.timestamp}`
        );
        return;
      }
      graph.addEdgeWithKey(e.id, e.from, e.to, { label: e.label });
      break;
    }
    case "node_patched": {
      const e = event as NodePatchedEvent;
      if (!graph.hasNode(e.id)) {
        console.error(
          `Skipping node_patched for non-existent node "${e.id}" at ${e.timestamp}`
        );
        return;
      }
      graph.mergeNodeAttributes(e.id, e.properties);
      break;
    }
    case "edge_removed": {
      const e = event as EdgeRemovedEvent;
      if (!graph.hasEdge(e.id)) {
        console.error(
          `Skipping edge_removed for non-existent edge "${e.id}" at ${e.timestamp}`
        );
        return;
      }
      graph.dropEdge(e.id);
      break;
    }
    case "node_removed": {
      const e = event as NodeRemovedEvent;
      if (!graph.hasNode(e.id)) {
        console.error(
          `Skipping node_removed for non-existent node "${e.id}" at ${e.timestamp}`
        );
        return;
      }
      graph.dropNode(e.id);
      break;
    }
  }
}

/**
 * Replay all events into a graphology MultiDirectedGraph.
 * Invalid event sequences are skipped with a console.error warning.
 */
export function buildGraph(events: readonly WhyEvent[]): MultiDirectedGraph {
  const graph = new MultiDirectedGraph();

  for (const event of events) {
    applyEvent(graph, event);
  }

  return graph;
}

/**
 * Replay events up to and including the cutoff ISO timestamp
 * into a graphology MultiDirectedGraph.
 */
export function buildGraphAt(
  events: readonly WhyEvent[],
  cutoff: string
): MultiDirectedGraph {
  const filtered = events.filter((e) => e.timestamp <= cutoff);
  return buildGraph(filtered);
}
