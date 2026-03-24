import { describe, it, expect } from "vitest";
import { MultiDirectedGraph } from "graphology";
import { listNodes } from "../../src/graph/nodes.js";
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

describe("listNodes", () => {
  it("returns all nodes when no filters", () => {
    const app = makeStructural({ id: "wg-app1", label: "App", name: "MyApp" });
    const feat = makeStructural({ id: "wg-feat1", label: "Feature", name: "Auth", parent: "wg-app1" });
    const dec = makeDecision({ id: "wg-dec1", affects: ["wg-feat1"], title: "Use JWT" });
    const graph = buildGraph([app, feat, dec]);

    const nodes = listNodes(graph);
    expect(nodes).toHaveLength(3);
    expect(nodes.map((n) => n.id).sort()).toEqual(["wg-app1", "wg-dec1", "wg-feat1"]);
  });

  it("returns id, label, name, and parent fields", () => {
    const feat = makeStructural({ id: "wg-feat1", label: "Feature", name: "Auth", parent: "wg-app1" });
    const graph = buildGraph([feat]);

    const nodes = listNodes(graph);
    expect(nodes).toEqual([
      { id: "wg-feat1", label: "Feature", name: "Auth", parent: "wg-app1" },
    ]);
  });

  it("uses title for Decision nodes", () => {
    const dec = makeDecision({ id: "wg-dec1", affects: [], title: "Use JWT" });
    const graph = buildGraph([dec]);

    const nodes = listNodes(graph);
    expect(nodes).toEqual([
      { id: "wg-dec1", label: "Decision", name: "Use JWT" },
    ]);
  });

  it("filters by label", () => {
    const app = makeStructural({ id: "wg-app1", label: "App", name: "MyApp" });
    const feat = makeStructural({ id: "wg-feat1", label: "Feature", name: "Auth" });
    const dec = makeDecision({ id: "wg-dec1", affects: [], title: "Use JWT" });
    const graph = buildGraph([app, feat, dec]);

    const nodes = listNodes(graph, { label: "Feature" });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("wg-feat1");
  });

  it("filters by parent", () => {
    const app = makeStructural({ id: "wg-app1", label: "App", name: "MyApp" });
    const feat = makeStructural({ id: "wg-feat1", label: "Feature", name: "Auth", parent: "wg-app1" });
    const feat2 = makeStructural({ id: "wg-feat2", label: "Feature", name: "Billing" });
    const graph = buildGraph([app, feat, feat2]);

    const nodes = listNodes(graph, { parent: "wg-app1" });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("wg-feat1");
  });

  it("search matches name/title substring case-insensitively", () => {
    const feat = makeStructural({ id: "wg-feat1", label: "Feature", name: "Authentication" });
    const comp = makeStructural({ id: "wg-comp1", label: "Component", name: "Login" });
    const dec = makeDecision({ id: "wg-dec1", affects: [], title: "JWT Auth Strategy" });
    const graph = buildGraph([feat, comp, dec]);

    const nodes = listNodes(graph, { search: "auth" });
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.id).sort()).toEqual(["wg-dec1", "wg-feat1"]);
  });

  it("excludes removed nodes", () => {
    const feat = makeStructural({
      id: "wg-feat1",
      label: "Feature",
      name: "Auth",
      removed_at: "2026-03-24T00:00:00Z",
    });
    const active = makeStructural({ id: "wg-feat2", label: "Feature", name: "Billing" });
    const graph = buildGraph([feat, active]);

    const nodes = listNodes(graph);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("wg-feat2");
  });
});
