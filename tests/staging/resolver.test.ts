import { describe, it, expect, vi } from "vitest";
import { MultiDirectedGraph } from "graphology";
import { resolveEntries } from "../../src/staging/resolver.js";
import type {
  StagingEntry,
  FeatureEntry,
  ComponentEntry,
  DecisionEntry,
  RefUpdateEntry,
  PatchEntry,
  DeprecateEntry,
  NodeRemovedEntry,
  ResolveReviewEntry,
  WhyEvent,
} from "../../src/core/types.js";
import { buildGraph } from "../../src/core/projection.js";

// ── Helpers ─────────────────────────────────────────────────

const APP_ID = "aaaaaaaa-0000-0000-0000-000000000000";
const FEATURE_ID = "bbbbbbbb-1111-1111-1111-111111111111";
const COMPONENT_ID = "cccccccc-2222-2222-2222-222222222222";

function makeGraph(events?: WhyEvent[]): MultiDirectedGraph {
  const defaultEvents: WhyEvent[] = [
    {
      type: "node_added",
      timestamp: "2026-01-01T00:00:00Z",
      id: APP_ID,
      label: "App",
      properties: { name: "TestApp" },
    },
    {
      type: "node_added",
      timestamp: "2026-01-01T00:01:00Z",
      id: FEATURE_ID,
      label: "Feature",
      properties: {
        name: "Auth",
        refs: [{ file: "src/auth/" }],
      },
    },
    {
      type: "edge_added",
      timestamp: "2026-01-01T00:01:01Z",
      id: "edge-1",
      label: "COMPOSES",
      from: APP_ID,
      to: FEATURE_ID,
    },
    {
      type: "node_added",
      timestamp: "2026-01-01T00:02:00Z",
      id: COMPONENT_ID,
      label: "Component",
      properties: {
        name: "OAuth",
        refs: [{ file: "src/auth/oauth.ts", symbol: "OAuthHandler" }],
      },
    },
    {
      type: "edge_added",
      timestamp: "2026-01-01T00:02:01Z",
      id: "edge-2",
      label: "COMPOSES",
      from: FEATURE_ID,
      to: COMPONENT_ID,
    },
  ];
  return buildGraph(events ?? defaultEvents);
}

// ── UUID assignment ─────────────────────────────────────────

describe("resolveEntries", () => {
  describe("UUID assignment", () => {
    it("assigns UUIDs to new feature nodes", () => {
      const entries: StagingEntry[] = [
        { type: "feature", name: "Notifications" },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(1);
      const r = result.resolved[0];
      expect(r.type).toBe("feature");
      expect(r.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("assigns UUIDs to new component nodes", () => {
      const entries: StagingEntry[] = [
        {
          type: "component",
          name: "Email sender",
          parent: FEATURE_ID,
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(1);
      const r = result.resolved[0];
      expect(r.type).toBe("component");
      expect(r.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("assigns UUIDs to new decision nodes", () => {
      const entries: StagingEntry[] = [
        {
          type: "decision",
          name: "Use JWT",
          context: "c",
          decision: "d",
          tradeoffs: "t",
          alternatives: "a",
          tags: ["arch"],
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("assigns UUIDs to new edges (deprecate, COMPOSES)", () => {
      const entries: StagingEntry[] = [
        {
          type: "component",
          name: "New thing",
          parent: FEATURE_ID,
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      // The component should have a composes edge ID
      const r = result.resolved[0];
      expect(r.type).toBe("component");
      expect(r.composesEdgeId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  // ── parent: app resolution ──────────────────────────────────

  describe("parent: app resolution", () => {
    it("resolves parent: app to the App node UUID", () => {
      const entries: StagingEntry[] = [
        {
          type: "component",
          name: "Core module",
          parent: "app",
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].parentId).toBe(APP_ID);
    });

    it("resolves parent: app from events when graph has no App node", () => {
      const events: WhyEvent[] = [
        {
          type: "node_added",
          timestamp: "2026-01-01T00:00:00Z",
          id: APP_ID,
          label: "App",
          properties: { name: "TestApp" },
        },
      ];
      const entries: StagingEntry[] = [
        { type: "component", name: "Root", parent: "app" },
      ];
      const result = resolveEntries(entries, buildGraph(events), events);

      expect(result.resolved[0].parentId).toBe(APP_ID);
    });
  });

  // ── File-scoped alias resolution ────────────────────────────

  describe("file-scoped alias resolution", () => {
    it("resolves alias references within same file", () => {
      const entries: StagingEntry[] = [
        {
          type: "feature",
          name: "Notifications",
          alias: "notif",
        },
        {
          type: "component",
          name: "Push sender",
          parent: "notif",
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(2);
      // The component's parent should resolve to the feature's assigned UUID
      expect(result.resolved[1].parentId).toBe(result.resolved[0].id);
    });

    it("resolves deprecate newNodeId alias", () => {
      const entries: StagingEntry[] = [
        {
          type: "component",
          name: "New OAuth",
          alias: "new-oauth",
          parent: FEATURE_ID,
        },
        {
          type: "deprecate",
          oldNodeId: COMPONENT_ID,
          newNodeId: "new-oauth",
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(2);
      const deprecateResolved = result.resolved[1];
      expect(deprecateResolved.type).toBe("deprecate");
      expect(deprecateResolved.newNodeId).toBe(result.resolved[0].id);
      expect(deprecateResolved.oldNodeId).toBe(COMPONENT_ID);
    });

    it("does not resolve aliases across different resolve calls", () => {
      const entriesA: StagingEntry[] = [
        {
          type: "feature",
          name: "Notifications",
          alias: "notif",
        },
      ];
      const entriesB: StagingEntry[] = [
        {
          type: "component",
          name: "Push sender",
          parent: "notif",
        },
      ];
      const graph = makeGraph();

      // Resolve first batch — alias "notif" is defined here
      resolveEntries(entriesA, graph, []);

      // Second batch should NOT see "notif" alias
      const resultB = resolveEntries(entriesB, graph, []);
      expect(resultB.errors).toHaveLength(1);
    });
  });

  // ── File path to UUID resolution ────────────────────────────

  describe("file path to UUID resolution", () => {
    it("resolves file path ref to node UUID via exact match", () => {
      const entries: StagingEntry[] = [
        {
          type: "component",
          name: "Sub component",
          parent: "src/auth/",
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].parentId).toBe(FEATURE_ID);
    });

    it("returns error for unresolvable file paths", () => {
      const entries: StagingEntry[] = [
        {
          type: "component",
          name: "Orphan",
          parent: "src/nonexistent/",
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain("src/nonexistent/");
    });
  });

  // ── Decision affects resolution ─────────────────────────────

  describe("decision affects resolution", () => {
    it("resolves affects file paths to node UUIDs", () => {
      const entries: StagingEntry[] = [
        {
          type: "decision",
          name: "Use JWT",
          context: "c",
          decision: "d",
          tradeoffs: "t",
          alternatives: "a",
          tags: ["arch"],
          affects: ["src/auth/"],
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].affects).toContain(FEATURE_ID);
    });

    it("keeps UUID affects values as-is", () => {
      const entries: StagingEntry[] = [
        {
          type: "decision",
          name: "Use JWT",
          context: "c",
          decision: "d",
          tradeoffs: "t",
          alternatives: "a",
          tags: ["arch"],
          affects: [FEATURE_ID],
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved[0].affects).toContain(FEATURE_ID);
    });

    it("resolves affects alias references", () => {
      const entries: StagingEntry[] = [
        {
          type: "feature",
          name: "Notifications",
          alias: "notif",
        },
        {
          type: "decision",
          name: "Use WebSockets for push",
          context: "c",
          decision: "d",
          tradeoffs: "t",
          alternatives: "a",
          tags: ["arch"],
          affects: ["notif"],
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(2);
      expect(result.resolved[1].affects).toContain(result.resolved[0].id);
    });
  });

  // ── Ref-update resolution ───────────────────────────────────

  describe("ref-update resolution", () => {
    it("resolves nodeId that is a UUID", () => {
      const entries: StagingEntry[] = [
        {
          type: "ref-update",
          nodeId: COMPONENT_ID,
          add: [{ file: "src/auth/new.ts" }],
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].nodeId).toBe(COMPONENT_ID);
    });

    it("resolves nodeId that is a file path", () => {
      const entries: StagingEntry[] = [
        {
          type: "ref-update",
          nodeId: "src/auth/",
          add: [{ file: "src/auth/new.ts" }],
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].nodeId).toBe(FEATURE_ID);
    });

    it("resolves nodeId that is an alias", () => {
      const entries: StagingEntry[] = [
        {
          type: "feature",
          name: "Notifications",
          alias: "notif",
        },
        {
          type: "ref-update",
          nodeId: "notif",
          add: [{ file: "src/notifications/" }],
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(2);
      expect(result.resolved[1].nodeId).toBe(result.resolved[0].id);
    });
  });

  // ── Patch resolution ────────────────────────────────────────

  describe("patch resolution", () => {
    it("resolves nodeId in patch entry", () => {
      const entries: StagingEntry[] = [
        {
          type: "patch",
          nodeId: "src/auth/",
          properties: { description: "Updated auth" },
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].nodeId).toBe(FEATURE_ID);
    });
  });

  // ── Node-removed resolution ─────────────────────────────────

  describe("node-removed resolution", () => {
    it("resolves nodeId in node-removed entry", () => {
      const entries: StagingEntry[] = [
        {
          type: "node-removed",
          nodeId: COMPONENT_ID,
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].nodeId).toBe(COMPONENT_ID);
    });
  });

  // ── Resolve-review passthrough ──────────────────────────────

  describe("resolve-review passthrough", () => {
    it("passes through resolve-review entries unchanged", () => {
      const entries: StagingEntry[] = [
        {
          type: "resolve-review",
          reviewId: "review-123",
          action: "supersede",
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].type).toBe("resolve-review");
      expect(result.resolved[0].reviewId).toBe("review-123");
    });
  });

  // ── Deprecate alias for new-node reference ──────────────────

  describe("deprecate entry resolution", () => {
    it("resolves deprecate oldNodeId and newNodeId as UUIDs", () => {
      const oldId = COMPONENT_ID;
      const newId = FEATURE_ID;
      const entries: StagingEntry[] = [
        {
          type: "deprecate",
          oldNodeId: oldId,
          newNodeId: newId,
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].oldNodeId).toBe(oldId);
      expect(result.resolved[0].newNodeId).toBe(newId);
    });

    it("resolves deprecate with file path references", () => {
      const entries: StagingEntry[] = [
        {
          type: "deprecate",
          oldNodeId: "src/auth/",
          newNodeId: COMPONENT_ID,
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].oldNodeId).toBe(FEATURE_ID);
    });
  });

  // ── Error handling ──────────────────────────────────────────

  describe("error handling", () => {
    it("collects errors for unresolvable references without stopping", () => {
      const entries: StagingEntry[] = [
        {
          type: "component",
          name: "Orphan1",
          parent: "nonexistent-ref",
        },
        {
          type: "feature",
          name: "Valid feature",
        },
        {
          type: "component",
          name: "Orphan2",
          parent: "also-nonexistent",
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      // Valid feature should resolve
      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].type).toBe("feature");

      // Two errors for the unresolvable parents
      expect(result.errors).toHaveLength(2);
    });

    it("errors when decision supersedes reference is unresolvable", () => {
      const entries: StagingEntry[] = [
        {
          type: "decision",
          name: "Replace X",
          context: "c",
          decision: "d",
          tradeoffs: "t",
          alternatives: "a",
          tags: ["arch"],
          supersedes: "nonexistent-decision-id",
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain("nonexistent-decision-id");
    });
  });

  // ── Cross-entry alias within same file ──────────────────────

  describe("complex cross-entry scenarios", () => {
    it("resolves chain: feature -> component -> decision affects", () => {
      const entries: StagingEntry[] = [
        {
          type: "feature",
          name: "Payments",
          alias: "payments",
        },
        {
          type: "component",
          name: "Stripe integration",
          alias: "stripe",
          parent: "payments",
        },
        {
          type: "decision",
          name: "Use Stripe over Braintree",
          context: "c",
          decision: "d",
          tradeoffs: "t",
          alternatives: "a",
          tags: ["arch"],
          affects: ["stripe", "payments"],
        },
      ];
      const result = resolveEntries(entries, makeGraph(), []);

      expect(result.resolved).toHaveLength(3);
      const [feature, component, decision] = result.resolved;

      expect(component.parentId).toBe(feature.id);
      expect(decision.affects).toContain(feature.id);
      expect(decision.affects).toContain(component.id);
    });
  });
});
