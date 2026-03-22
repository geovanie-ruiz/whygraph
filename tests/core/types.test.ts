import { describe, it, expect } from "vitest";
import type {
  WhyEvent,
  NodeAddedEvent,
  EdgeAddedEvent,
  NodePatchedEvent,
  EdgeRemovedEvent,
  NodeRemovedEvent,
  DecisionProperties,
  NodeProperties,
  WhygraphConfig,
  StagingEntry,
  DecisionEntry,
  FeatureEntry,
  ReviewEntry,
  VizSnapshot,
  ProcessResult,
} from "../../src/core/types.js";

describe("types", () => {
  it("can construct all five event types", () => {
    const nodeAdded: NodeAddedEvent = {
      type: "node_added",
      timestamp: "2026-03-22T00:00:00Z",
      id: "550e8400-e29b-41d4-a716-446655440000",
      label: "App",
      properties: { name: "TestApp" },
    };

    const edgeAdded: EdgeAddedEvent = {
      type: "edge_added",
      timestamp: "2026-03-22T00:00:00Z",
      id: "edge-550e8400-e29b-41d4-a716-446655440001",
      label: "COMPOSES",
      from: "app-id",
      to: "feat-id",
    };

    const nodePatched: NodePatchedEvent = {
      type: "node_patched",
      timestamp: "2026-03-22T00:00:00Z",
      id: "550e8400-e29b-41d4-a716-446655440000",
      properties: { status: "superseded" },
    };

    const edgeRemoved: EdgeRemovedEvent = {
      type: "edge_removed",
      timestamp: "2026-03-22T00:00:00Z",
      id: "edge-550e8400-e29b-41d4-a716-446655440001",
    };

    const nodeRemoved: NodeRemovedEvent = {
      type: "node_removed",
      timestamp: "2026-03-22T00:00:00Z",
      id: "550e8400-e29b-41d4-a716-446655440000",
    };

    const events: WhyEvent[] = [
      nodeAdded,
      edgeAdded,
      nodePatched,
      edgeRemoved,
      nodeRemoved,
    ];

    expect(events).toHaveLength(5);
    expect(events.map((e) => e.type)).toEqual([
      "node_added",
      "edge_added",
      "node_patched",
      "edge_removed",
      "node_removed",
    ]);
  });

  it("can construct a full Decision with all required properties", () => {
    const decision: DecisionProperties = {
      title: "Use event sourcing",
      date: "2026-03-22",
      context: "Need temporal history",
      decision: "Append-only event log with graph projection",
      tradeoffs: "Gained history, lost simplicity",
      alternatives: "Mutable DB: rejected",
      status: "active",
      affects: ["feat-core-uuid"],
      tags: ["arch", "data"],
    };

    expect(decision.status).toBe("active");
    expect(decision.tags).toContain("arch");
    expect(decision.affects).toHaveLength(1);
  });

  it("can construct structural node properties with refs", () => {
    const props: NodeProperties = {
      name: "OAuth Provider",
      description: "Handles OAuth flows",
      status: "active",
      refs: [
        { file: "src/auth/oauth.ts", symbol: "OAuthProvider" },
        { file: "src/auth/" },
      ],
    };

    expect(props.refs).toHaveLength(2);
    expect(props.refs![0].symbol).toBe("OAuthProvider");
    expect(props.refs![1].symbol).toBeUndefined();
  });

  it("can construct config with all environment options", () => {
    const config: WhygraphConfig = {
      appName: "TestApp",
      environment: "claude-code",
      syncTrigger: "hook",
      contextInjection: "always",
      autonomy: "supervised",
    };

    expect(config.environment).toBe("claude-code");
  });

  it("can construct all staging entry types", () => {
    const feature: FeatureEntry = {
      type: "feature",
      name: "Auth",
      alias: "feat-auth",
    };

    const decision: DecisionEntry = {
      type: "decision",
      name: "Use JWT",
      context: "Need stateless auth",
      decision: "JWT tokens",
      tradeoffs: "Gained stateless, lost revocation",
      alternatives: "Session cookies: rejected",
      tags: ["security", "arch"],
      filesTouched: ["src/auth/session.ts"],
    };

    const entries: StagingEntry[] = [feature, decision];
    expect(entries).toHaveLength(2);
  });

  it("can construct review and viz types", () => {
    const review: ReviewEntry = {
      id: "rev-001",
      newDecisionId: "d1",
      existingDecisionId: "d2",
      sharedNodeIds: ["comp-1"],
      status: "pending",
    };

    const snapshot: VizSnapshot = {
      timestamp: "2026-03-22T00:00:00Z",
      graph: {
        nodes: [{ id: "app", label: "App", name: "TestApp" }],
        edges: [],
      },
    };

    const result: ProcessResult = {
      eventsAppended: 5,
      errorsFound: 0,
      reviewsCreated: 1,
      filesProcessed: 2,
    };

    expect(review.status).toBe("pending");
    expect(snapshot.graph.nodes).toHaveLength(1);
    expect(result.eventsAppended).toBe(5);
  });
});
