import { describe, it, expect } from "vitest";
import {
  isStructuralNode,
  isDecisionNode,
  DECISION_TAGS,
} from "../../src/entity/types.js";
import type {
  StructuralNode,
  DecisionNode,
  Entity,
  DecisionTag,
  WhygraphConfig,
} from "../../src/entity/types.js";

describe("entity types", () => {
  it("constructs a structural node with required fields", () => {
    const node: StructuralNode = {
      id: "wg-a1b2",
      label: "Feature",
      name: "Authentication",
      status: "active",
      parent: "wg-app1",
      created_at: "2026-03-24T00:00:00Z",
      updated_at: "2026-03-24T00:00:00Z",
    };

    expect(node.label).toBe("Feature");
    expect(node.name).toBe("Authentication");
    expect(node.status).toBe("active");
    expect(node.parent).toBe("wg-app1");
    expect(node.removed_at).toBeUndefined();
  });

  it("constructs a decision node with all ADR fields", () => {
    const decision: DecisionNode = {
      id: "wg-c3d4",
      label: "Decision",
      title: "Use WebSockets for live updates",
      status: "active",
      date: "2026-03-24",
      affects: ["wg-a1b2", "wg-e5f6"],
      tags: ["arch", "integration"],
      context: "The baked HTML viz requires manual refresh.",
      decision: "Use WebSocket subscriptions from the server.",
      tradeoffs: "Gained: real-time. Lost: requires running server.",
      alternatives: "Polling — rejected: latency.",
      created_at: "2026-03-24T10:00:00Z",
      updated_at: "2026-03-24T10:00:00Z",
    };

    expect(decision.label).toBe("Decision");
    expect(decision.title).toBe("Use WebSockets for live updates");
    expect(decision.affects).toHaveLength(2);
    expect(decision.tags).toContain("arch");
    expect(decision.supersedes).toBeUndefined();
    expect(decision.removed_at).toBeUndefined();
  });

  it("supports optional removed_at on both entity types", () => {
    const removed: StructuralNode = {
      id: "wg-x1y2",
      label: "Component",
      name: "OldModule",
      status: "deprecated",
      parent: "wg-a1b2",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-03-01T00:00:00Z",
      removed_at: "2026-03-20T00:00:00Z",
    };

    expect(removed.removed_at).toBe("2026-03-20T00:00:00Z");
  });

  it("supports supersedes on decision nodes", () => {
    const superseding: DecisionNode = {
      id: "wg-new1",
      label: "Decision",
      title: "Switch to SSE instead of WebSockets",
      status: "active",
      date: "2026-03-25",
      affects: ["wg-a1b2"],
      tags: ["arch"],
      supersedes: "wg-c3d4",
      context: "WebSocket overhead too high for unidirectional updates.",
      decision: "Use Server-Sent Events.",
      tradeoffs: "Gained: simplicity. Lost: bidirectional capability.",
      alternatives: "Keep WebSockets — rejected: unnecessary complexity.",
      created_at: "2026-03-25T00:00:00Z",
      updated_at: "2026-03-25T00:00:00Z",
    };

    expect(superseding.supersedes).toBe("wg-c3d4");
  });

  it("type guards distinguish structural from decision nodes", () => {
    const feature: Entity = {
      id: "wg-feat",
      label: "Feature",
      name: "Auth",
      status: "active",
      created_at: "2026-03-24T00:00:00Z",
      updated_at: "2026-03-24T00:00:00Z",
    };

    const decision: Entity = {
      id: "wg-dec1",
      label: "Decision",
      title: "Use JWT",
      status: "active",
      date: "2026-03-24",
      affects: ["wg-feat"],
      tags: ["security"],
      context: "Need stateless auth.",
      decision: "Use JWT tokens.",
      tradeoffs: "Gained: stateless. Lost: token size.",
      alternatives: "Sessions — rejected: requires server state.",
      created_at: "2026-03-24T00:00:00Z",
      updated_at: "2026-03-24T00:00:00Z",
    };

    expect(isStructuralNode(feature)).toBe(true);
    expect(isDecisionNode(feature)).toBe(false);
    expect(isStructuralNode(decision)).toBe(false);
    expect(isDecisionNode(decision)).toBe(true);
  });

  it("exports the closed tag set as a runtime array", () => {
    expect(DECISION_TAGS).toContain("arch");
    expect(DECISION_TAGS).toContain("data");
    expect(DECISION_TAGS).toContain("security");
    expect(DECISION_TAGS).toContain("performance");
    expect(DECISION_TAGS).toContain("integration");
    expect(DECISION_TAGS).toContain("infra");
    expect(DECISION_TAGS).toContain("ux");
    expect(DECISION_TAGS).toHaveLength(7);
  });

  it("config schema accepts all expected fields", () => {
    const config: WhygraphConfig = {
      appName: "MyApp",
      environment: "claude-code",
      prefix: "wg-",
      idLength: 4,
      tags: ["arch", "data", "security", "performance", "integration", "infra", "ux"],
      mpcMode: "default",
      serverPort: 4777,
    };

    expect(config.appName).toBe("MyApp");
    expect(config.prefix).toBe("wg-");
    expect(config.idLength).toBe(4);
    expect(config.mpcMode).toBe("default");
  });

  it("structural nodes support refs with optional symbol", () => {
    const node: StructuralNode = {
      id: "wg-comp",
      label: "Component",
      name: "SessionManager",
      status: "active",
      parent: "wg-feat",
      refs: [
        { file: "src/auth/session.ts" },
        { file: "src/auth/session.ts", symbol: "createSession" },
      ],
      created_at: "2026-03-24T00:00:00Z",
      updated_at: "2026-03-24T00:00:00Z",
    };

    expect(node.refs).toHaveLength(2);
    expect(node.refs![0].symbol).toBeUndefined();
    expect(node.refs![1].symbol).toBe("createSession");
  });

  it("App node has no parent", () => {
    const app: StructuralNode = {
      id: "wg-app1",
      label: "App",
      name: "Whygraph",
      status: "active",
      created_at: "2026-03-24T00:00:00Z",
      updated_at: "2026-03-24T00:00:00Z",
    };

    expect(app.parent).toBeUndefined();
    expect(app.label).toBe("App");
  });
});
