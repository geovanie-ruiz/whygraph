import graphology from "graphology";
import { buildGraph } from "./projection.js";
import type { Entity } from "../entity/types.js";

type MultiDirectedGraph = graphology.MultiDirectedGraph;

/**
 * Build a graph projection at a specific point in time.
 * Includes entities where created_at <= timestamp AND (removed_at is null OR removed_at > timestamp).
 */
export function buildGraphAt(
  entities: Entity[],
  timestamp: string,
): MultiDirectedGraph {
  const filtered = entities.filter((entity) => {
    if (entity.created_at > timestamp) return false;
    if (entity.removed_at !== undefined && entity.removed_at <= timestamp)
      return false;
    return true;
  });
  return buildGraph(filtered);
}

/**
 * Collect all unique timestamps (created_at and removed_at) from entities, sorted chronologically.
 */
export function getTimestamps(entities: Entity[]): string[] {
  const set = new Set<string>();
  for (const entity of entities) {
    set.add(entity.created_at);
    if (entity.removed_at !== undefined) {
      set.add(entity.removed_at);
    }
  }
  return [...set].sort();
}
