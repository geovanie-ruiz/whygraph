import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import lockfile from "proper-lockfile";
import { MultiDirectedGraph } from "graphology";
import { parseEntries } from "./parser.js";
import { resolveEntries, type ResolvedEntry } from "./resolver.js";
import { appendReview, loadReviews, autoDismissForNodes } from "./reviews.js";
import { clearErrors, writeErrors } from "./errors.js";
import { loadEvents, appendEvents } from "../core/events.js";
import { validateEvent, type ValidationContext } from "../core/validate.js";
import { buildGraph } from "../core/projection.js";
import type {
  WhyEvent,
  NodeAddedEvent,
  EdgeAddedEvent,
  NodePatchedEvent,
  EdgeRemovedEvent,
  NodeRemovedEvent,
  DecisionProperties,
  DecisionTag,
  ErrorEntry,
  ReviewEntry,
  ProcessResult,
  GraphNodeAttributes,
  GraphDecisionAttributes,
  SymbolRef,
} from "../core/types.js";

// ── Constants ────────────────────────────────────────────────

const STAGING_DIR = "staging";
const LOCK_FILE = ".lock";
const LOCK_STALE = 10_000;
const LOCK_RETRIES = 3;

const TYPE_PRIORITY: Record<string, number> = {
  feature: 0,
  component: 1,
  "ref-update": 2,
  patch: 3,
  deprecate: 4,
  decision: 5,
  "resolve-review": 6,
  "node-removed": 7,
};

const DECISION_PLACEHOLDER = "(not yet documented)";

// ── Lock helpers ─────────────────────────────────────────────

function lockPath(whygraphDir: string): string {
  return path.join(whygraphDir, LOCK_FILE);
}

async function ensureLockTarget(whygraphDir: string): Promise<void> {
  const target = lockPath(whygraphDir);
  try {
    await fsPromises.access(target);
  } catch {
    await fsPromises.writeFile(target, "", "utf-8");
  }
}

// ── Staging file reading ─────────────────────────────────────

interface StagingFileData {
  fileName: string;
  filePath: string;
  content: string;
}

async function readStagingFiles(
  whygraphDir: string,
): Promise<StagingFileData[]> {
  const stagingDir = path.join(whygraphDir, STAGING_DIR);
  let entries: string[];
  try {
    entries = await fsPromises.readdir(stagingDir);
  } catch {
    return [];
  }

  const mdFiles = entries.filter((f) => f.endsWith(".md"));
  const results: StagingFileData[] = [];

  for (const fileName of mdFiles) {
    const filePath = path.join(stagingDir, fileName);
    const content = await fsPromises.readFile(filePath, "utf-8");
    results.push({ fileName, filePath, content });
  }

  return results;
}

// ── Entry to events conversion ───────────────────────────────

function makeTimestamp(entry: ResolvedEntry): string {
  return (entry.timestamp as string) || new Date().toISOString();
}

function fillDecisionPlaceholder(value: string | undefined): string {
  if (!value || value.trim() === "") return DECISION_PLACEHOLDER;
  return value;
}

function entriesToEvents(
  resolved: ResolvedEntry[],
  graph: MultiDirectedGraph,
): WhyEvent[] {
  const events: WhyEvent[] = [];

  for (const entry of resolved) {
    const timestamp = makeTimestamp(entry);

    switch (entry.type) {
      case "feature": {
        const nodeEvent: NodeAddedEvent = {
          type: "node_added",
          timestamp,
          id: entry.id as string,
          label: "Feature",
          properties: {
            name: entry.name as string,
            ...(entry.description
              ? { description: entry.description as string }
              : {}),
            ...(entry.refs ? { refs: entry.refs as SymbolRef[] } : {}),
          },
        };
        events.push(nodeEvent);

        // Feature -> App COMPOSES edge: find App node
        let appId: string | null = null;
        graph.forEachNode((nodeId, attrs) => {
          if (
            (attrs as GraphNodeAttributes).label === "App" &&
            appId === null
          ) {
            appId = nodeId;
          }
        });
        if (appId) {
          const edgeEvent: EdgeAddedEvent = {
            type: "edge_added",
            timestamp,
            id: `edge-${crypto.randomUUID()}`,
            label: "COMPOSES",
            from: appId,
            to: entry.id as string,
          };
          events.push(edgeEvent);
        }
        break;
      }

      case "component": {
        const nodeEvent: NodeAddedEvent = {
          type: "node_added",
          timestamp,
          id: entry.id as string,
          label: "Component",
          properties: {
            name: entry.name as string,
            ...(entry.description
              ? { description: entry.description as string }
              : {}),
            ...(entry.refs ? { refs: entry.refs as SymbolRef[] } : {}),
          },
        };
        events.push(nodeEvent);

        const edgeEvent: EdgeAddedEvent = {
          type: "edge_added",
          timestamp,
          id: `edge-${entry.composesEdgeId as string}`,
          label: "COMPOSES",
          from: entry.parentId as string,
          to: entry.id as string,
        };
        events.push(edgeEvent);
        break;
      }

      case "decision": {
        const affects = (entry.affects as string[]) || [];
        const decisionProps: DecisionProperties = {
          title: entry.name as string,
          date: (entry.date as string) || new Date().toISOString().slice(0, 10),
          context: fillDecisionPlaceholder(entry.context as string),
          decision: fillDecisionPlaceholder(entry.decision as string),
          tradeoffs: fillDecisionPlaceholder(entry.tradeoffs as string),
          alternatives: fillDecisionPlaceholder(entry.alternatives as string),
          status: "active",
          affects,
          tags: (entry.tags as DecisionTag[]) || [],
          ...(entry.supersedes
            ? { supersedes: entry.supersedes as string }
            : {}),
        };

        const nodeEvent: NodeAddedEvent = {
          type: "node_added",
          timestamp,
          id: entry.id as string,
          label: "Decision",
          properties: decisionProps,
        };
        events.push(nodeEvent);

        // AFFECTS edges
        for (const affectedId of affects) {
          const edgeEvent: EdgeAddedEvent = {
            type: "edge_added",
            timestamp,
            id: `edge-${crypto.randomUUID()}`,
            label: "AFFECTS",
            from: entry.id as string,
            to: affectedId,
          };
          events.push(edgeEvent);
        }

        // SUPERSEDES edge
        if (entry.supersedes) {
          const supersedesEdge: EdgeAddedEvent = {
            type: "edge_added",
            timestamp,
            id: `edge-${crypto.randomUUID()}`,
            label: "SUPERSEDES",
            from: entry.id as string,
            to: entry.supersedes as string,
          };
          events.push(supersedesEdge);

          // Patch old decision status to superseded
          const patchEvent: NodePatchedEvent = {
            type: "node_patched",
            timestamp,
            id: entry.supersedes as string,
            properties: { status: "superseded" },
          };
          events.push(patchEvent);
        }
        break;
      }

      case "ref-update": {
        const nodeId = entry.nodeId as string;
        // Get current refs from graph
        let currentRefs: SymbolRef[] = [];
        if (graph.hasNode(nodeId)) {
          const attrs = graph.getNodeAttributes(nodeId) as GraphNodeAttributes;
          currentRefs = attrs.refs ? [...attrs.refs] : [];
        }

        const addRefs = (entry.add as SymbolRef[]) || [];
        const removeRefs = (entry.remove as SymbolRef[]) || [];

        // Remove refs
        const removeSet = new Set(removeRefs.map((r) => r.file));
        let updatedRefs = currentRefs.filter((r) => !removeSet.has(r.file));

        // Add refs
        updatedRefs = [...updatedRefs, ...addRefs];

        const patchEvent: NodePatchedEvent = {
          type: "node_patched",
          timestamp,
          id: nodeId,
          properties: { refs: updatedRefs } as Record<string, unknown>,
        };
        events.push(patchEvent);
        break;
      }

      case "patch": {
        const patchEvent: NodePatchedEvent = {
          type: "node_patched",
          timestamp,
          id: entry.nodeId as string,
          properties: entry.properties as Record<string, unknown>,
        };
        events.push(patchEvent);
        break;
      }

      case "deprecate": {
        // Patch old node status
        const patchEvent: NodePatchedEvent = {
          type: "node_patched",
          timestamp,
          id: entry.oldNodeId as string,
          properties: { status: "deprecated" },
        };
        events.push(patchEvent);

        // DEPRECATES edge
        const edgeEvent: EdgeAddedEvent = {
          type: "edge_added",
          timestamp,
          id: `edge-${entry.id as string}`,
          label: "DEPRECATES",
          from: entry.newNodeId as string,
          to: entry.oldNodeId as string,
        };
        events.push(edgeEvent);
        break;
      }

      case "resolve-review": {
        // Resolve-review is handled separately (not producing events directly,
        // it updates reviews.jsonl). But if action is "supersede", we need to
        // produce a SUPERSEDES edge and status patch. This is handled in the
        // main pipeline logic since it requires loading reviews.
        break;
      }

      case "node-removed": {
        const removeEvent: NodeRemovedEvent = {
          type: "node_removed",
          timestamp,
          id: entry.nodeId as string,
        };
        events.push(removeEvent);
        break;
      }
    }
  }

  return events;
}

// ── Cascade removal ──────────────────────────────────────────

function collectCascadeRemovals(
  nodeId: string,
  graph: MultiDirectedGraph,
  timestamp: string,
): WhyEvent[] {
  const events: WhyEvent[] = [];
  const removedNodeIds = new Set<string>();

  function removeDescendants(currentId: string): void {
    if (removedNodeIds.has(currentId)) return;
    removedNodeIds.add(currentId);

    // Find COMPOSES children (edges where currentId is source, label COMPOSES)
    const outEdges = graph.outEdges(currentId);
    for (const edgeKey of outEdges) {
      const attrs = graph.getEdgeAttributes(edgeKey);
      if (attrs.label === "COMPOSES") {
        const target = graph.target(edgeKey);
        removeDescendants(target);
      }
    }
  }

  // Collect all descendants
  removeDescendants(nodeId);

  // Now generate edge removal events for all edges touching removed nodes
  const edgesToRemove = new Set<string>();
  for (const removedId of removedNodeIds) {
    if (!graph.hasNode(removedId)) continue;
    const edges = graph.edges(removedId);
    for (const edgeKey of edges) {
      edgesToRemove.add(edgeKey);
    }
  }

  for (const edgeKey of edgesToRemove) {
    const edgeRemoveEvent: EdgeRemovedEvent = {
      type: "edge_removed",
      timestamp,
      id: edgeKey,
    };
    events.push(edgeRemoveEvent);
  }

  // Remove descendant nodes (not the original node, that's already in the main events)
  for (const removedId of removedNodeIds) {
    if (removedId === nodeId) continue; // Already handled by main event
    const nodeRemoveEvent: NodeRemovedEvent = {
      type: "node_removed",
      timestamp,
      id: removedId,
    };
    events.push(nodeRemoveEvent);
  }

  // Update decision affects arrays to remove references to removed nodes
  const decisionPatches: WhyEvent[] = [];
  graph.forEachNode((nId, attrs) => {
    const nodeAttrs = attrs as GraphDecisionAttributes;
    if (nodeAttrs.label !== "Decision") return;
    if (removedNodeIds.has(nId)) return;

    const affects = nodeAttrs.affects;
    if (!affects) return;

    const filteredAffects = affects.filter((a) => !removedNodeIds.has(a));
    if (filteredAffects.length !== affects.length) {
      if (filteredAffects.length === 0) {
        // Decision is fully orphaned — remove it
        const decisionEdges = graph.edges(nId);
        for (const edgeKey of decisionEdges) {
          if (!edgesToRemove.has(edgeKey)) {
            edgesToRemove.add(edgeKey);
            decisionPatches.push({
              type: "edge_removed",
              timestamp,
              id: edgeKey,
            } as EdgeRemovedEvent);
          }
        }
        decisionPatches.push({
          type: "node_removed",
          timestamp,
          id: nId,
        } as NodeRemovedEvent);
        removedNodeIds.add(nId);
      } else {
        // Patch decision affects
        decisionPatches.push({
          type: "node_patched",
          timestamp,
          id: nId,
          properties: { affects: filteredAffects },
        } as NodePatchedEvent);
      }
    }
  });

  events.push(...decisionPatches);

  return events;
}

// ── Supersede detection ──────────────────────────────────────

function detectSupersedeCandidates(
  events: WhyEvent[],
  existingEvents: readonly WhyEvent[],
  graph: MultiDirectedGraph,
): ReviewEntry[] {
  const reviews: ReviewEntry[] = [];

  // Collect new decision IDs and their affects from the events we're about to append
  const newDecisions = new Map<string, Set<string>>();
  for (const event of events) {
    if (
      event.type === "node_added" &&
      event.label === "Decision"
    ) {
      const props = event.properties as DecisionProperties;
      const affectSet = new Set(props.affects || []);
      newDecisions.set(event.id, affectSet);
    }
  }

  if (newDecisions.size === 0) return reviews;

  // Find existing active decisions and their affects
  const existingDecisions = new Map<string, Set<string>>();
  graph.forEachNode((nodeId, attrs) => {
    const nodeAttrs = attrs as GraphDecisionAttributes;
    if (nodeAttrs.label !== "Decision") return;
    if (nodeAttrs.status !== "active") return;
    if (nodeAttrs.affects) {
      existingDecisions.set(nodeId, new Set(nodeAttrs.affects));
    }
  });

  // Check for overlapping affects
  for (const [newId, newAffects] of newDecisions) {
    for (const [existingId, existingAffects] of existingDecisions) {
      if (newId === existingId) continue;
      const shared: string[] = [];
      for (const nodeId of newAffects) {
        if (existingAffects.has(nodeId)) {
          shared.push(nodeId);
        }
      }
      if (shared.length > 0) {
        // Check if the new decision already supersedes the existing one
        const alreadySupersedes = events.some(
          (e) =>
            e.type === "edge_added" &&
            e.label === "SUPERSEDES" &&
            (e as EdgeAddedEvent).from === newId &&
            (e as EdgeAddedEvent).to === existingId,
        );
        if (!alreadySupersedes) {
          reviews.push({
            id: crypto.randomUUID(),
            newDecisionId: newId,
            existingDecisionId: existingId,
            sharedNodeIds: shared,
            status: "pending",
          });
        }
      }
    }
  }

  return reviews;
}

// ── Dedup check ──────────────────────────────────────────────

function dedupEvents(
  newEvents: WhyEvent[],
  existingEvents: readonly WhyEvent[],
): WhyEvent[] {
  // Build a set of recent event signatures for dedup
  const recentSignatures = new Set<string>();
  for (const event of existingEvents) {
    recentSignatures.add(`${event.timestamp}|${event.type}|${event.id}`);
  }

  return newEvents.filter((event) => {
    const sig = `${event.timestamp}|${event.type}|${event.id}`;
    return !recentSignatures.has(sig);
  });
}

// ── Main processor ───────────────────────────────────────────

export async function processStaging(
  whygraphDir: string,
): Promise<ProcessResult> {
  // 1. Acquire advisory lock
  await ensureLockTarget(whygraphDir);
  const target = lockPath(whygraphDir);
  const release = await lockfile.lock(target, {
    stale: LOCK_STALE,
    retries: LOCK_RETRIES,
  });

  try {
    return await doProcess(whygraphDir);
  } finally {
    // 14. Release lock
    await release();
  }
}

async function doProcess(whygraphDir: string): Promise<ProcessResult> {
  const result: ProcessResult = {
    eventsAppended: 0,
    errorsFound: 0,
    reviewsCreated: 0,
    filesProcessed: 0,
  };

  // 2. Clear errors.jsonl
  await clearErrors(whygraphDir);

  // 3. Read all .md files from staging/
  const stagingFiles = await readStagingFiles(whygraphDir);
  if (stagingFiles.length === 0) return result;

  result.filesProcessed = stagingFiles.length;

  // 4. Parse each file
  const allEntries: Array<{
    entry: import("../core/types.js").StagingEntry;
    fileName: string;
  }> = [];

  for (const file of stagingFiles) {
    const parsed = parseEntries(file.content);
    for (const entry of parsed) {
      // Assign timestamp from entry or default to now
      if (!entry.timestamp) {
        entry.timestamp = new Date().toISOString();
      }
      allEntries.push({ entry, fileName: file.fileName });
    }
  }

  // 5. Sort by type priority
  allEntries.sort((a, b) => {
    const pa = TYPE_PRIORITY[a.entry.type] ?? 99;
    const pb = TYPE_PRIORITY[b.entry.type] ?? 99;
    return pa - pb;
  });

  // Load existing events and build graph
  const eventsPath = path.join(whygraphDir, "events.jsonl");
  let existingEvents: WhyEvent[] = [];
  if (fs.existsSync(eventsPath)) {
    existingEvents = loadEvents(eventsPath);
  }
  const graph = buildGraph(existingEvents);

  // 6. Resolve entries
  const sortedEntries = allEntries.map((e) => e.entry);
  const fileNameMap = new Map(
    allEntries.map((e, i) => [i, e.fileName]),
  );
  const resolveResult = resolveEntries(sortedEntries, graph, existingEvents);

  // Collect resolve errors
  const errorEntries: ErrorEntry[] = [];
  for (const err of resolveResult.errors) {
    const fileName = fileNameMap.get(err.entryIndex) || "unknown";
    errorEntries.push({
      entry: JSON.stringify(err.entry),
      error: err.error,
      file: fileName,
    });
  }

  // 7. Convert resolved entries to events
  let newEvents = entriesToEvents(resolveResult.resolved, graph);

  // 8. Validate each event
  const validEvents: WhyEvent[] = [];
  const nodeLabels = new Map<string, import("../core/types.js").NodeLabel>();

  // Build context from existing graph
  graph.forEachNode((nodeId, attrs) => {
    nodeLabels.set(
      nodeId,
      (attrs as GraphNodeAttributes).label,
    );
  });

  for (const event of newEvents) {
    // Update context with newly added nodes
    if (event.type === "node_added") {
      nodeLabels.set(event.id, event.label);
    }

    const context: ValidationContext = { nodeLabels };
    const validation = validateEvent(event, context);

    if (validation.valid) {
      validEvents.push(event);
    } else {
      errorEntries.push({
        entry: JSON.stringify(event),
        error: validation.errors.join("; "),
        file: "processor",
      });
    }
  }

  // 10. Handle cascade removals for node-removed entries
  const cascadeEvents: WhyEvent[] = [];
  const removedNodeIds: string[] = [];
  for (const event of validEvents) {
    if (event.type === "node_removed") {
      removedNodeIds.push(event.id);
      if (graph.hasNode(event.id)) {
        const cascade = collectCascadeRemovals(
          event.id,
          graph,
          event.timestamp,
        );
        cascadeEvents.push(...cascade);
      }
    }
  }

  // Validate cascade events too
  const validCascadeEvents: WhyEvent[] = [];
  for (const event of cascadeEvents) {
    if (event.type === "node_added") {
      nodeLabels.set(event.id, event.label);
    }
    const context: ValidationContext = { nodeLabels };
    const validation = validateEvent(event, context);
    if (validation.valid) {
      validCascadeEvents.push(event);
    }
  }

  const allValidEvents = [...validEvents, ...validCascadeEvents];

  // 9. Detect supersede candidates
  const supersedeReviews = detectSupersedeCandidates(
    allValidEvents,
    existingEvents,
    graph,
  );

  // Write reviews
  for (const review of supersedeReviews) {
    await appendReview(whygraphDir, review);
  }
  result.reviewsCreated = supersedeReviews.length;

  // Auto-dismiss reviews for removed nodes
  if (removedNodeIds.length > 0) {
    await autoDismissForNodes(whygraphDir, removedNodeIds);
  }

  // 11. Dedup check
  const dedupedEvents = dedupEvents(allValidEvents, existingEvents);

  // 8. Write errors
  if (errorEntries.length > 0) {
    await writeErrors(whygraphDir, errorEntries);
  }
  result.errorsFound = errorEntries.length;

  // 12. Atomic append all valid events
  if (dedupedEvents.length > 0) {
    appendEvents(eventsPath, dedupedEvents);
  }
  result.eventsAppended = dedupedEvents.length;

  // 13. Delete processed staging files
  for (const file of stagingFiles) {
    await fsPromises.unlink(file.filePath);
  }

  return result;
}
