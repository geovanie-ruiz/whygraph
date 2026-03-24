import { describe, it, expect } from "vitest";
import { MultiDirectedGraph } from "graphology";
import { getGaps } from "../../src/graph/gaps.js";
import type { StructuralNode, DecisionNode } from "../../src/entity/types.js";
import { buildGraph } from "../../src/graph/projection.js";

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
    created_at: "2026-03-24T00:00:00Z",
    updated_at: "2026-03-24T00:00:00Z",
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
    date: "2026-03-24",
    tags: ["arch"],
    context: "context",
    decision: "decision",
    tradeoffs: "tradeoffs",
    alternatives: "alternatives",
    created_at: "2026-03-24T00:00:00Z",
    updated_at: "2026-03-24T00:00:00Z",
    ...overrides,
  };
}

describe("getGaps", () => {
  it("node with AFFECTS edge is not a gap", () => {
    const feat = makeStructural({ id: "wg-feat1", label: "Feature", name: "Auth" });
    const dec = makeDecision({ id: "wg-dec1", affects: ["wg-feat1"] });
    const graph = buildGraph([feat, dec]);

    const gaps = getGaps(graph);
    expect(gaps).toEqual([]);
  });

  it("node without AFFECTS edge is a gap", () => {
    const feat = makeStructural({ id: "wg-feat1", label: "Feature", name: "Auth" });
    const graph = buildGraph([feat]);

    const gaps = getGaps(graph);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].id).toBe("wg-feat1");
  });

  it("Features ordered before Components", () => {
    const comp = makeStructural({ id: "wg-comp1", label: "Component", name: "Login" });
    const feat = makeStructural({ id: "wg-feat1", label: "Feature", name: "Auth" });
    const graph = buildGraph([comp, feat]);

    const gaps = getGaps(graph);
    expect(gaps).toHaveLength(2);
    expect(gaps[0].label).toBe("Feature");
    expect(gaps[1].label).toBe("Component");
  });

  it("Components ordered by COMPOSES depth (shallow first)", () => {
    const app = makeStructural({ id: "wg-app1", label: "App", name: "MyApp" });
    const feat = makeStructural({ id: "wg-feat1", label: "Feature", name: "Auth", parent: "wg-app1" });
    const compShallow = makeStructural({ id: "wg-comp1", label: "Component", name: "Shallow", parent: "wg-feat1" });
    const compDeep = makeStructural({ id: "wg-comp2", label: "Component", name: "Deep", parent: "wg-comp1" });
    // Decision covers app and feat so they aren't gaps
    const dec = makeDecision({ id: "wg-dec1", affects: ["wg-feat1"] });
    const graph = buildGraph([app, feat, compShallow, compDeep, dec]);

    const gaps = getGaps(graph);
    const compGaps = gaps.filter((g) => g.label === "Component");
    expect(compGaps).toHaveLength(2);
    expect(compGaps[0].id).toBe("wg-comp1");
    expect(compGaps[1].id).toBe("wg-comp2");
  });

  it("limit truncates results", () => {
    const feat1 = makeStructural({ id: "wg-feat1", label: "Feature", name: "Auth" });
    const feat2 = makeStructural({ id: "wg-feat2", label: "Feature", name: "Billing" });
    const comp1 = makeStructural({ id: "wg-comp1", label: "Component", name: "Login" });
    const graph = buildGraph([feat1, feat2, comp1]);

    const gaps = getGaps(graph, 2);
    expect(gaps).toHaveLength(2);
  });

  it("removed nodes excluded", () => {
    const feat = makeStructural({
      id: "wg-feat1",
      label: "Feature",
      name: "Auth",
      removed_at: "2026-03-24T00:00:00Z",
    });
    const graph = buildGraph([feat]);

    const gaps = getGaps(graph);
    expect(gaps).toEqual([]);
  });

  it("App nodes are never gaps", () => {
    const app = makeStructural({ id: "wg-app1", label: "App", name: "MyApp" });
    const graph = buildGraph([app]);

    const gaps = getGaps(graph);
    expect(gaps).toEqual([]);
  });
});
