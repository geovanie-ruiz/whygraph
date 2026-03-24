import { describe, it, expect } from "vitest";
import { MultiDirectedGraph } from "graphology";
import { buildGraphAt, getTimestamps } from "../../src/graph/temporal.js";
import type {
  Entity,
  StructuralNode,
  DecisionNode,
} from "../../src/entity/types.js";

// ---- helpers ----

function makeStructural(
  overrides: Partial<StructuralNode> & {
    id: string;
    label: StructuralNode["label"];
    name: string;
  },
): StructuralNode {
  return {
    status: "active",
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
    ...overrides,
  };
}

function makeDecision(
  overrides: Partial<DecisionNode> & { id: string; affects: string[] },
): DecisionNode {
  return {
    label: "Decision",
    title: "Some Decision",
    status: "active",
    date: "2026-03-01",
    tags: ["arch"],
    context: "context",
    decision: "decision",
    tradeoffs: "tradeoffs",
    alternatives: "alternatives",
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildGraphAt", () => {
  it("returns empty graph when timestamp is before any entity", () => {
    const app = makeStructural({
      id: "wg-app1",
      label: "App",
      name: "MyApp",
      created_at: "2026-03-10T00:00:00Z",
    });

    const graph = buildGraphAt([app], "2026-03-09T00:00:00Z");

    expect(graph).toBeInstanceOf(MultiDirectedGraph);
    expect(graph.order).toBe(0);
    expect(graph.size).toBe(0);
  });

  it("includes entities created at or before the timestamp", () => {
    const app = makeStructural({
      id: "wg-app1",
      label: "App",
      name: "MyApp",
      created_at: "2026-03-01T00:00:00Z",
    });
    const feat = makeStructural({
      id: "wg-feat1",
      label: "Feature",
      name: "Auth",
      parent: "wg-app1",
      created_at: "2026-03-05T00:00:00Z",
    });
    const comp = makeStructural({
      id: "wg-comp1",
      label: "Component",
      name: "Login",
      parent: "wg-feat1",
      created_at: "2026-03-15T00:00:00Z",
    });

    const graph = buildGraphAt([app, feat, comp], "2026-03-10T00:00:00Z");

    expect(graph.order).toBe(2);
    expect(graph.hasNode("wg-app1")).toBe(true);
    expect(graph.hasNode("wg-feat1")).toBe(true);
    expect(graph.hasNode("wg-comp1")).toBe(false);
  });

  it("excludes entities removed at or before the timestamp", () => {
    const app = makeStructural({
      id: "wg-app1",
      label: "App",
      name: "MyApp",
      created_at: "2026-03-01T00:00:00Z",
      removed_at: "2026-03-08T00:00:00Z",
    });

    const graph = buildGraphAt([app], "2026-03-10T00:00:00Z");

    expect(graph.order).toBe(0);
  });

  it("includes entity at exact created_at timestamp", () => {
    const app = makeStructural({
      id: "wg-app1",
      label: "App",
      name: "MyApp",
      created_at: "2026-03-10T00:00:00Z",
    });

    const graph = buildGraphAt([app], "2026-03-10T00:00:00Z");

    expect(graph.order).toBe(1);
    expect(graph.hasNode("wg-app1")).toBe(true);
  });

  it("excludes entity at exact removed_at timestamp", () => {
    const app = makeStructural({
      id: "wg-app1",
      label: "App",
      name: "MyApp",
      created_at: "2026-03-01T00:00:00Z",
      removed_at: "2026-03-10T00:00:00Z",
    });

    const graph = buildGraphAt([app], "2026-03-10T00:00:00Z");

    expect(graph.order).toBe(0);
  });
});

describe("getTimestamps", () => {
  it("returns sorted unique timestamps", () => {
    const app = makeStructural({
      id: "wg-app1",
      label: "App",
      name: "MyApp",
      created_at: "2026-03-10T00:00:00Z",
    });
    const feat = makeStructural({
      id: "wg-feat1",
      label: "Feature",
      name: "Auth",
      created_at: "2026-03-05T00:00:00Z",
    });
    const comp = makeStructural({
      id: "wg-comp1",
      label: "Component",
      name: "Login",
      created_at: "2026-03-10T00:00:00Z",
    });

    const timestamps = getTimestamps([app, feat, comp]);

    expect(timestamps).toEqual([
      "2026-03-05T00:00:00Z",
      "2026-03-10T00:00:00Z",
    ]);
  });

  it("includes both created_at and removed_at values", () => {
    const app = makeStructural({
      id: "wg-app1",
      label: "App",
      name: "MyApp",
      created_at: "2026-03-01T00:00:00Z",
      removed_at: "2026-03-15T00:00:00Z",
    });
    const dec = makeDecision({
      id: "wg-dec1",
      affects: ["wg-app1"],
      created_at: "2026-03-05T00:00:00Z",
      removed_at: "2026-03-20T00:00:00Z",
    });

    const timestamps = getTimestamps([app, dec]);

    expect(timestamps).toEqual([
      "2026-03-01T00:00:00Z",
      "2026-03-05T00:00:00Z",
      "2026-03-15T00:00:00Z",
      "2026-03-20T00:00:00Z",
    ]);
  });
});
