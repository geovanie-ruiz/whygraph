import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { processStaging } from "../../src/staging/processor.js";
import { loadEvents } from "../../src/core/events.js";
import { loadReviews } from "../../src/staging/reviews.js";
import type {
  WhyEvent,
  NodeAddedEvent,
  EdgeAddedEvent,
  NodePatchedEvent,
  NodeRemovedEvent,
  EdgeRemovedEvent,
  DecisionProperties,
} from "../../src/core/types.js";

// ── Helpers ─────────────────────────────────────────────────

function makeAppEvent(appId: string): NodeAddedEvent {
  return {
    type: "node_added",
    timestamp: "2024-01-01T00:00:00.000Z",
    id: appId,
    label: "App",
    properties: { name: "TestApp" },
  };
}

function makeFeatureEvent(id: string, appId: string, name: string): WhyEvent[] {
  return [
    {
      type: "node_added",
      timestamp: "2024-01-01T00:00:01.000Z",
      id,
      label: "Feature",
      properties: { name },
    } as NodeAddedEvent,
    {
      type: "edge_added",
      timestamp: "2024-01-01T00:00:01.000Z",
      id: `edge-${crypto.randomUUID()}`,
      label: "COMPOSES",
      from: appId,
      to: id,
    } as EdgeAddedEvent,
  ];
}

function makeComponentEvent(
  id: string,
  parentId: string,
  name: string,
): WhyEvent[] {
  return [
    {
      type: "node_added",
      timestamp: "2024-01-01T00:00:01.500Z",
      id,
      label: "Component",
      properties: { name },
    } as NodeAddedEvent,
    {
      type: "edge_added",
      timestamp: "2024-01-01T00:00:01.500Z",
      id: `edge-${crypto.randomUUID()}`,
      label: "COMPOSES",
      from: parentId,
      to: id,
    } as EdgeAddedEvent,
  ];
}

function makeDecisionEvent(
  id: string,
  affects: string[],
  title: string = "Test Decision",
): WhyEvent[] {
  const events: WhyEvent[] = [
    {
      type: "node_added",
      timestamp: "2024-01-01T00:00:02.000Z",
      id,
      label: "Decision",
      properties: {
        title,
        date: "2024-01-01",
        context: "test context",
        decision: "test decision",
        tradeoffs: "test tradeoffs",
        alternatives: "test alternatives",
        status: "active",
        affects,
        tags: ["arch"],
      },
    } as NodeAddedEvent,
  ];
  for (const affectId of affects) {
    events.push({
      type: "edge_added",
      timestamp: "2024-01-01T00:00:02.000Z",
      id: `edge-${crypto.randomUUID()}`,
      label: "AFFECTS",
      from: id,
      to: affectId,
    } as EdgeAddedEvent);
  }
  return events;
}

function seedEventsFile(whygraphDir: string, events: WhyEvent[]): void {
  const eventsPath = path.join(whygraphDir, "events.jsonl");
  const content = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  fs.writeFileSync(eventsPath, content, "utf-8");
}

function writeStagingFile(
  whygraphDir: string,
  fileName: string,
  content: string,
): void {
  const stagingDir = path.join(whygraphDir, "staging");
  fs.mkdirSync(stagingDir, { recursive: true });
  fs.writeFileSync(path.join(stagingDir, fileName), content, "utf-8");
}

// ── Tests ───────────────────────────────────────────────────

describe("cascade removal", () => {
  let tmpDir: string;
  let whygraphDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "whygraph-cascade-"));
    whygraphDir = path.join(tmpDir, ".whygraph");
    fs.mkdirSync(whygraphDir, { recursive: true });
    fs.mkdirSync(path.join(whygraphDir, "staging"), { recursive: true });
    fs.writeFileSync(path.join(whygraphDir, "events.jsonl"), "", "utf-8");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("recursive COMPOSES descendant removal", () => {
    it("removes direct COMPOSES children", async () => {
      const appId = crypto.randomUUID();
      const featureId = crypto.randomUUID();
      const componentId = crypto.randomUUID();

      seedEventsFile(whygraphDir, [
        makeAppEvent(appId),
        ...makeFeatureEvent(featureId, appId, "Auth"),
        ...makeComponentEvent(componentId, featureId, "Login"),
      ]);

      writeStagingFile(
        whygraphDir,
        "remove.md",
        `## [node-removed] ${featureId}\n`,
      );

      const result = await processStaging(whygraphDir);

      const events = loadEvents(path.join(whygraphDir, "events.jsonl"));
      const removedNodes = events.filter((e) => e.type === "node_removed");
      const removedIds = removedNodes.map((e) => e.id);
      expect(removedIds).toContain(featureId);
      expect(removedIds).toContain(componentId);
    });

    it("removes deeply nested COMPOSES descendants (grandchildren)", async () => {
      const appId = crypto.randomUUID();
      const featureId = crypto.randomUUID();
      const comp1 = crypto.randomUUID();
      const comp2 = crypto.randomUUID();

      seedEventsFile(whygraphDir, [
        makeAppEvent(appId),
        ...makeFeatureEvent(featureId, appId, "Auth"),
        ...makeComponentEvent(comp1, featureId, "Login"),
        ...makeComponentEvent(comp2, comp1, "LoginButton"),
      ]);

      writeStagingFile(
        whygraphDir,
        "remove.md",
        `## [node-removed] ${featureId}\n`,
      );

      await processStaging(whygraphDir);

      const events = loadEvents(path.join(whygraphDir, "events.jsonl"));
      const removedNodes = events.filter((e) => e.type === "node_removed");
      const removedIds = removedNodes.map((e) => e.id);
      expect(removedIds).toContain(featureId);
      expect(removedIds).toContain(comp1);
      expect(removedIds).toContain(comp2);
    });

    it("removes all edges touching removed nodes", async () => {
      const appId = crypto.randomUUID();
      const featureId = crypto.randomUUID();
      const componentId = crypto.randomUUID();

      seedEventsFile(whygraphDir, [
        makeAppEvent(appId),
        ...makeFeatureEvent(featureId, appId, "Auth"),
        ...makeComponentEvent(componentId, featureId, "Login"),
      ]);

      writeStagingFile(
        whygraphDir,
        "remove.md",
        `## [node-removed] ${featureId}\n`,
      );

      await processStaging(whygraphDir);

      const events = loadEvents(path.join(whygraphDir, "events.jsonl"));
      const edgeRemovals = events.filter((e) => e.type === "edge_removed");
      // Should remove: App->Feature COMPOSES edge, Feature->Component COMPOSES edge
      expect(edgeRemovals.length).toBe(2);
    });
  });

  describe("event ordering", () => {
    it("emits node_patched before edge_removed before node_removed", async () => {
      const appId = crypto.randomUUID();
      const featureId = crypto.randomUUID();
      const componentId = crypto.randomUUID();
      const decisionId = crypto.randomUUID();

      seedEventsFile(whygraphDir, [
        makeAppEvent(appId),
        ...makeFeatureEvent(featureId, appId, "Auth"),
        ...makeComponentEvent(componentId, featureId, "Login"),
        // Decision affects both feature and another unremoved node
        ...makeDecisionEvent(decisionId, [featureId, appId], "Arch Decision"),
      ]);

      writeStagingFile(
        whygraphDir,
        "remove.md",
        `## [node-removed] ${featureId}\n`,
      );

      await processStaging(whygraphDir);

      const events = loadEvents(path.join(whygraphDir, "events.jsonl"));
      // Get only the new events (after the seed events)
      const seedCount = 2 + 2 + 2 + 3; // app + feature(2) + component(2) + decision(1+2 edges)
      // Actually count seed events precisely
      const seedEvents = [
        makeAppEvent(appId),
        ...makeFeatureEvent(featureId, appId, "Auth"),
        ...makeComponentEvent(componentId, featureId, "Login"),
        ...makeDecisionEvent(decisionId, [featureId, appId], "Arch Decision"),
      ];
      const newEvents = events.slice(seedEvents.length);

      // Find positions of different event types
      const patchIndices: number[] = [];
      const edgeRemoveIndices: number[] = [];
      const nodeRemoveIndices: number[] = [];

      for (let i = 0; i < newEvents.length; i++) {
        const e = newEvents[i];
        if (e.type === "node_patched") patchIndices.push(i);
        if (e.type === "edge_removed") edgeRemoveIndices.push(i);
        if (e.type === "node_removed") nodeRemoveIndices.push(i);
      }

      // node_patched should come before edge_removed
      if (patchIndices.length > 0 && edgeRemoveIndices.length > 0) {
        const lastPatch = Math.max(...patchIndices);
        const firstEdgeRemove = Math.min(...edgeRemoveIndices);
        expect(lastPatch).toBeLessThan(firstEdgeRemove);
      }

      // edge_removed should come before node_removed
      if (edgeRemoveIndices.length > 0 && nodeRemoveIndices.length > 0) {
        const lastEdgeRemove = Math.max(...edgeRemoveIndices);
        const firstNodeRemove = Math.min(...nodeRemoveIndices);
        expect(lastEdgeRemove).toBeLessThan(firstNodeRemove);
      }
    });

    it("removes children before parent (leaf-first order)", async () => {
      const appId = crypto.randomUUID();
      const featureId = crypto.randomUUID();
      const comp1 = crypto.randomUUID();
      const comp2 = crypto.randomUUID();

      seedEventsFile(whygraphDir, [
        makeAppEvent(appId),
        ...makeFeatureEvent(featureId, appId, "Auth"),
        ...makeComponentEvent(comp1, featureId, "Login"),
        ...makeComponentEvent(comp2, comp1, "LoginButton"),
      ]);

      writeStagingFile(
        whygraphDir,
        "remove.md",
        `## [node-removed] ${featureId}\n`,
      );

      await processStaging(whygraphDir);

      const events = loadEvents(path.join(whygraphDir, "events.jsonl"));
      const nodeRemovals = events.filter(
        (e) => e.type === "node_removed",
      ) as NodeRemovedEvent[];
      const removalOrder = nodeRemovals.map((e) => e.id);

      // comp2 (deepest) should be removed before comp1, comp1 before featureId
      const comp2Idx = removalOrder.indexOf(comp2);
      const comp1Idx = removalOrder.indexOf(comp1);
      const featureIdx = removalOrder.indexOf(featureId);

      expect(comp2Idx).toBeLessThan(comp1Idx);
      expect(comp1Idx).toBeLessThan(featureIdx);
    });
  });

  describe("orphaned decision cleanup", () => {
    it("removes a decision that loses all AFFECTS edges", async () => {
      const appId = crypto.randomUUID();
      const featureId = crypto.randomUUID();
      const decisionId = crypto.randomUUID();

      seedEventsFile(whygraphDir, [
        makeAppEvent(appId),
        ...makeFeatureEvent(featureId, appId, "Auth"),
        ...makeDecisionEvent(decisionId, [featureId], "Orphan Decision"),
      ]);

      writeStagingFile(
        whygraphDir,
        "remove.md",
        `## [node-removed] ${featureId}\n`,
      );

      await processStaging(whygraphDir);

      const events = loadEvents(path.join(whygraphDir, "events.jsonl"));
      const removedNodes = events.filter((e) => e.type === "node_removed");
      const removedIds = removedNodes.map((e) => e.id);

      expect(removedIds).toContain(featureId);
      expect(removedIds).toContain(decisionId);
    });

    it("patches a decision that loses only some AFFECTS edges", async () => {
      const appId = crypto.randomUUID();
      const feat1 = crypto.randomUUID();
      const feat2 = crypto.randomUUID();
      const decisionId = crypto.randomUUID();

      seedEventsFile(whygraphDir, [
        makeAppEvent(appId),
        ...makeFeatureEvent(feat1, appId, "Auth"),
        ...makeFeatureEvent(feat2, appId, "Payments"),
        ...makeDecisionEvent(decisionId, [feat1, feat2], "Multi Decision"),
      ]);

      writeStagingFile(
        whygraphDir,
        "remove.md",
        `## [node-removed] ${feat1}\n`,
      );

      await processStaging(whygraphDir);

      const events = loadEvents(path.join(whygraphDir, "events.jsonl"));

      // Decision should NOT be removed
      const removedNodes = events
        .filter((e) => e.type === "node_removed")
        .map((e) => e.id);
      expect(removedNodes).not.toContain(decisionId);

      // Decision should be patched with updated affects
      const patchEvents = events.filter(
        (e) => e.type === "node_patched" && e.id === decisionId,
      ) as NodePatchedEvent[];
      expect(patchEvents.length).toBe(1);

      const props = patchEvents[0].properties as { affects?: string[] };
      expect(props.affects).toEqual([feat2]);
    });
  });

  describe("review auto-dismissal", () => {
    it("auto-dismisses reviews referencing cascade-removed nodes", async () => {
      const appId = crypto.randomUUID();
      const featureId = crypto.randomUUID();
      const componentId = crypto.randomUUID();

      seedEventsFile(whygraphDir, [
        makeAppEvent(appId),
        ...makeFeatureEvent(featureId, appId, "Auth"),
        ...makeComponentEvent(componentId, featureId, "Login"),
      ]);

      // Pre-populate a review referencing the component (cascade-removed)
      const reviewContent =
        JSON.stringify({
          id: "review-cascade",
          newDecisionId: "d1",
          existingDecisionId: "d2",
          sharedNodeIds: [componentId],
          status: "pending",
        }) + "\n";
      fs.writeFileSync(
        path.join(whygraphDir, "reviews.jsonl"),
        reviewContent,
      );

      writeStagingFile(
        whygraphDir,
        "remove.md",
        `## [node-removed] ${featureId}\n`,
      );

      await processStaging(whygraphDir);

      const reviews = await loadReviews(whygraphDir);
      expect(reviews.length).toBe(0);
    });

    it("auto-dismisses reviews referencing orphaned decisions", async () => {
      const appId = crypto.randomUUID();
      const featureId = crypto.randomUUID();
      const decisionId = crypto.randomUUID();

      seedEventsFile(whygraphDir, [
        makeAppEvent(appId),
        ...makeFeatureEvent(featureId, appId, "Auth"),
        ...makeDecisionEvent(decisionId, [featureId], "Orphan Decision"),
      ]);

      // Review referencing the orphaned decision
      const reviewContent =
        JSON.stringify({
          id: "review-orphan",
          newDecisionId: decisionId,
          existingDecisionId: "d-other",
          sharedNodeIds: [featureId],
          status: "pending",
        }) + "\n";
      fs.writeFileSync(
        path.join(whygraphDir, "reviews.jsonl"),
        reviewContent,
      );

      writeStagingFile(
        whygraphDir,
        "remove.md",
        `## [node-removed] ${featureId}\n`,
      );

      await processStaging(whygraphDir);

      const reviews = await loadReviews(whygraphDir);
      expect(reviews.length).toBe(0);
    });

    it("preserves reviews that do not reference removed nodes", async () => {
      const appId = crypto.randomUUID();
      const featureId = crypto.randomUUID();
      const otherFeatureId = crypto.randomUUID();

      seedEventsFile(whygraphDir, [
        makeAppEvent(appId),
        ...makeFeatureEvent(featureId, appId, "Auth"),
        ...makeFeatureEvent(otherFeatureId, appId, "Payments"),
      ]);

      // One review for removed node, one for unrelated node
      const reviews = [
        {
          id: "review-removed",
          newDecisionId: "d1",
          existingDecisionId: "d2",
          sharedNodeIds: [featureId],
          status: "pending",
        },
        {
          id: "review-kept",
          newDecisionId: "d3",
          existingDecisionId: "d4",
          sharedNodeIds: [otherFeatureId],
          status: "pending",
        },
      ];
      const reviewContent = reviews.map((r) => JSON.stringify(r)).join("\n") + "\n";
      fs.writeFileSync(
        path.join(whygraphDir, "reviews.jsonl"),
        reviewContent,
      );

      writeStagingFile(
        whygraphDir,
        "remove.md",
        `## [node-removed] ${featureId}\n`,
      );

      await processStaging(whygraphDir);

      const remaining = await loadReviews(whygraphDir);
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe("review-kept");
    });
  });

  describe("direct decision removal", () => {
    it("removes a decision node directly (no COMPOSES descendants)", async () => {
      const appId = crypto.randomUUID();
      const featureId = crypto.randomUUID();
      const decisionId = crypto.randomUUID();

      seedEventsFile(whygraphDir, [
        makeAppEvent(appId),
        ...makeFeatureEvent(featureId, appId, "Auth"),
        ...makeDecisionEvent(decisionId, [featureId], "Direct Remove"),
      ]);

      writeStagingFile(
        whygraphDir,
        "remove.md",
        `## [node-removed] ${decisionId}\n`,
      );

      await processStaging(whygraphDir);

      const events = loadEvents(path.join(whygraphDir, "events.jsonl"));
      const removedNodes = events
        .filter((e) => e.type === "node_removed")
        .map((e) => e.id);
      expect(removedNodes).toContain(decisionId);
      // Feature should NOT be removed
      expect(removedNodes).not.toContain(featureId);

      // AFFECTS edge should be removed
      const edgeRemovals = events.filter((e) => e.type === "edge_removed");
      expect(edgeRemovals.length).toBeGreaterThan(0);
    });
  });
});
