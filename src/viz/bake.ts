import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGraphAt } from "../core/projection.js";
import type { WhyEvent, VizSnapshot, VizNode, VizEdge } from "../core/types.js";

// graphology ships CJS-only; named ESM imports fail at runtime under Node
import graphology from "graphology";
type MultiDirectedGraph = graphology.MultiDirectedGraph;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Serialize a graphology MultiDirectedGraph into VizSnapshot graph shape.
 */
function serializeGraph(
  graph: MultiDirectedGraph
): { nodes: VizNode[]; edges: VizEdge[] } {
  const nodes: VizNode[] = [];
  graph.forEachNode((id, attributes) => {
    nodes.push({ id, ...attributes } as VizNode);
  });

  const edges: VizEdge[] = [];
  graph.forEachEdge((id, attributes, source, target) => {
    edges.push({ id, from: source, to: target, ...attributes } as VizEdge);
  });

  return { nodes, edges };
}

/**
 * Extract unique timestamps from events, sorted chronologically.
 */
function uniqueTimestamps(events: readonly WhyEvent[]): string[] {
  const set = new Set<string>();
  for (const e of events) {
    set.add(e.timestamp);
  }
  return [...set].sort();
}

/**
 * Build snapshots: one per unique timestamp, each containing the full
 * graph state at that point in time.
 */
function buildSnapshots(events: readonly WhyEvent[]): VizSnapshot[] {
  const timestamps = uniqueTimestamps(events);
  return timestamps.map((ts) => {
    const graph = buildGraphAt(events, ts);
    return {
      timestamp: ts,
      graph: serializeGraph(graph),
    };
  });
}

/**
 * Bake a complete, self-contained HTML visualization from events.
 *
 * @param events - Full event log
 * @param reviewCount - Number of pending reviews
 * @returns Complete HTML string with inlined D3 and baked snapshots
 */
export function bakeViz(
  events: readonly WhyEvent[],
  reviewCount: number
): string {
  const snapshots = buildSnapshots(events);
  const bakedAt = new Date(Date.now()).toISOString();

  // Read and inline D3
  const d3Path = path.resolve(__dirname, "../../node_modules/d3/dist/d3.min.js");
  const d3Script = fs.readFileSync(d3Path, "utf-8");

  // Read HTML template
  const templatePath = path.resolve(__dirname, "template/index.html");
  const template = fs.readFileSync(templatePath, "utf-8");

  // Replace placeholders
  const html = template
    .replace("%%D3_SCRIPT%%", d3Script)
    .replace("%%SNAPSHOTS%%", JSON.stringify(snapshots))
    .replace("%%BAKED_AT%%", bakedAt)
    .replace("%%REVIEW_COUNT%%", String(reviewCount));

  return html;
}
