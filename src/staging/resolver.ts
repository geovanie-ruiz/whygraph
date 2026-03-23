import * as crypto from "node:crypto";
import type { MultiDirectedGraph } from "graphology";
import type {
  StagingEntry,
  WhyEvent,
  GraphNodeAttributes,
  SymbolRef,
} from "../core/types.js";

// ── Result types ────────────────────────────────────────────

export interface ResolvedEntry {
  type: StagingEntry["type"];
  id?: string;
  [key: string]: unknown;
}

export interface ResolveError {
  entryIndex: number;
  entry: StagingEntry;
  error: string;
}

export interface ResolveResult {
  resolved: ResolvedEntry[];
  errors: ResolveError[];
}

// ── UUID detection ──────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(value: string): boolean {
  return UUID_RE.test(value);
}

// ── Find App node UUID ──────────────────────────────────────

function findAppNodeId(
  graph: MultiDirectedGraph,
  events: readonly WhyEvent[]
): string | null {
  // Try graph first
  let appId: string | null = null;
  graph.forEachNode((nodeId, attrs) => {
    if ((attrs as GraphNodeAttributes).label === "App" && appId === null) {
      appId = nodeId;
    }
  });
  if (appId) return appId;

  // Fall back to events — first node_added event is the App node
  for (const event of events) {
    if (event.type === "node_added" && event.label === "App") {
      return event.id;
    }
  }

  return null;
}

// ── Find node by file ref (exact match) ─────────────────────

function findNodeByFileRef(
  graph: MultiDirectedGraph,
  filePath: string
): string | null {
  let found: string | null = null;
  graph.forEachNode((nodeId, attrs) => {
    if (found !== null) return;
    const refs = (attrs as GraphNodeAttributes).refs as
      | SymbolRef[]
      | undefined;
    if (!refs) return;
    for (const ref of refs) {
      if (ref.file === filePath) {
        found = nodeId;
        return;
      }
    }
  });
  return found;
}

// ── Resolve a reference string ──────────────────────────────

/**
 * Resolve a reference string to a UUID. The reference can be:
 * 1. An alias defined in the current file scope
 * 2. The literal "app" (resolves to App node)
 * 3. A UUID (kept as-is, validated against graph for node existence)
 * 4. A file path (resolved via exact ref match in graph)
 */
function resolveRef(
  ref: string,
  aliasMap: Map<string, string>,
  graph: MultiDirectedGraph,
  appNodeId: string | null,
  context: string
): { uuid: string } | { error: string } {
  // 1. Alias
  if (aliasMap.has(ref)) {
    return { uuid: aliasMap.get(ref)! };
  }

  // 2. "app" literal
  if (ref === "app") {
    if (appNodeId) return { uuid: appNodeId };
    return { error: `${context}: cannot resolve "app" — no App node found` };
  }

  // 3. UUID — validate it exists in graph
  if (isUUID(ref)) {
    if (graph.hasNode(ref)) {
      return { uuid: ref };
    }
    // For new nodes we may not have them in the graph yet,
    // but the UUID format is valid — accept it
    return { uuid: ref };
  }

  // 4. File path ref lookup
  const nodeId = findNodeByFileRef(graph, ref);
  if (nodeId) return { uuid: nodeId };

  return {
    error: `${context}: cannot resolve reference "${ref}" — not a known alias, UUID, or file path ref`,
  };
}

// ── Main resolve function ───────────────────────────────────

/**
 * Resolve all references in parsed staging entries to concrete UUIDs.
 *
 * - Aliases are file-scoped (defined by entries in this batch, not persisted)
 * - `parent: app` resolves to the App node UUID
 * - File paths resolve via exact ref match in the current graph
 * - New nodes and edges get crypto.randomUUID()
 */
export function resolveEntries(
  entries: readonly StagingEntry[],
  graph: MultiDirectedGraph,
  events: readonly WhyEvent[]
): ResolveResult {
  const resolved: ResolvedEntry[] = [];
  const errors: ResolveError[] = [];
  const aliasMap = new Map<string, string>();
  const appNodeId = findAppNodeId(graph, events);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    switch (entry.type) {
      case "feature": {
        const id = crypto.randomUUID();
        if (entry.alias) {
          aliasMap.set(entry.alias, id);
        }
        resolved.push({
          type: "feature",
          id,
          name: entry.name,
          description: entry.description,
          refs: entry.refs,
          timestamp: entry.timestamp,
          alias: entry.alias,
        });
        break;
      }

      case "component": {
        const id = crypto.randomUUID();
        if (entry.alias) {
          aliasMap.set(entry.alias, id);
        }

        const parentResult = resolveRef(
          entry.parent,
          aliasMap,
          graph,
          appNodeId,
          `component "${entry.name}" parent`
        );

        if ("error" in parentResult) {
          errors.push({ entryIndex: i, entry, error: parentResult.error });
          break;
        }

        const composesEdgeId = crypto.randomUUID();

        resolved.push({
          type: "component",
          id,
          name: entry.name,
          parentId: parentResult.uuid,
          composesEdgeId,
          description: entry.description,
          refs: entry.refs,
          timestamp: entry.timestamp,
          alias: entry.alias,
        });
        break;
      }

      case "decision": {
        const id = crypto.randomUUID();

        // Resolve affects
        let resolvedAffects: string[] | undefined;
        let hasError = false;
        if (entry.affects && entry.affects.length > 0) {
          resolvedAffects = [];
          for (const affect of entry.affects) {
            const result = resolveRef(
              affect,
              aliasMap,
              graph,
              appNodeId,
              `decision "${entry.name}" affects`
            );
            if ("error" in result) {
              errors.push({ entryIndex: i, entry, error: result.error });
              hasError = true;
              break;
            }
            resolvedAffects.push(result.uuid);
          }
        }
        if (hasError) break;

        // Resolve supersedes
        let resolvedSupersedes: string | undefined;
        if (entry.supersedes) {
          const result = resolveRef(
            entry.supersedes,
            aliasMap,
            graph,
            appNodeId,
            `decision "${entry.name}" supersedes`
          );
          if ("error" in result) {
            errors.push({ entryIndex: i, entry, error: result.error });
            break;
          }
          resolvedSupersedes = result.uuid;
        }

        resolved.push({
          type: "decision",
          id,
          name: entry.name,
          context: entry.context,
          decision: entry.decision,
          tradeoffs: entry.tradeoffs,
          alternatives: entry.alternatives,
          tags: entry.tags,
          affects: resolvedAffects,
          supersedes: resolvedSupersedes,
          filesTouched: entry.filesTouched,
          timestamp: entry.timestamp,
          date: entry.date,
        });
        break;
      }

      case "ref-update": {
        const nodeResult = resolveRef(
          entry.nodeId,
          aliasMap,
          graph,
          appNodeId,
          `ref-update nodeId`
        );
        if ("error" in nodeResult) {
          errors.push({ entryIndex: i, entry, error: nodeResult.error });
          break;
        }

        resolved.push({
          type: "ref-update",
          nodeId: nodeResult.uuid,
          add: entry.add,
          remove: entry.remove,
          timestamp: entry.timestamp,
        });
        break;
      }

      case "patch": {
        const nodeResult = resolveRef(
          entry.nodeId,
          aliasMap,
          graph,
          appNodeId,
          `patch nodeId`
        );
        if ("error" in nodeResult) {
          errors.push({ entryIndex: i, entry, error: nodeResult.error });
          break;
        }

        resolved.push({
          type: "patch",
          nodeId: nodeResult.uuid,
          properties: entry.properties,
          timestamp: entry.timestamp,
        });
        break;
      }

      case "deprecate": {
        const oldResult = resolveRef(
          entry.oldNodeId,
          aliasMap,
          graph,
          appNodeId,
          `deprecate oldNodeId`
        );
        if ("error" in oldResult) {
          errors.push({ entryIndex: i, entry, error: oldResult.error });
          break;
        }

        const newResult = resolveRef(
          entry.newNodeId,
          aliasMap,
          graph,
          appNodeId,
          `deprecate newNodeId`
        );
        if ("error" in newResult) {
          errors.push({ entryIndex: i, entry, error: newResult.error });
          break;
        }

        const edgeId = crypto.randomUUID();

        resolved.push({
          type: "deprecate",
          id: edgeId,
          oldNodeId: oldResult.uuid,
          newNodeId: newResult.uuid,
          timestamp: entry.timestamp,
        });
        break;
      }

      case "resolve-review": {
        resolved.push({
          type: "resolve-review",
          reviewId: entry.reviewId,
          action: entry.action,
          timestamp: entry.timestamp,
        });
        break;
      }

      case "node-removed": {
        const nodeResult = resolveRef(
          entry.nodeId,
          aliasMap,
          graph,
          appNodeId,
          `node-removed nodeId`
        );
        if ("error" in nodeResult) {
          errors.push({ entryIndex: i, entry, error: nodeResult.error });
          break;
        }

        resolved.push({
          type: "node-removed",
          nodeId: nodeResult.uuid,
          timestamp: entry.timestamp,
        });
        break;
      }
    }
  }

  return { resolved, errors };
}
