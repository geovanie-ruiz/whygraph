import { describe, it, expect, vi } from "vitest";
import { MultiDirectedGraph } from "graphology";
import { buildGraph } from "../../src/graph/projection.js";
import type {
  Entity,
  StructuralNode,
  DecisionNode,
} from "../../src/entity/types.js";

// ---- helpers ----

function makeStructural(overrides: Partial<StructuralNode> & { id: string; label: StructuralNode["label"]; name: string }): StructuralNode {
  return {
    status: "active",
    created_at: "2026-03-24T00:00:00Z",
    updated_at: "2026-03-24T00:00:00Z",
    ...overrides,
  };
}

function makeDecision(overrides: Partial<DecisionNode> & { id: string; affects: string[] }): DecisionNode {
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

describe("buildGraph", () => {
  it("returns an empty graph for an empty entity array", () => {
    const graph = buildGraph([]);
    expect(graph).toBeInstanceOf(MultiDirectedGraph);
    expect(graph.order).toBe(0);
    expect(graph.size).toBe(0);
  });

  it("creates one node for a single structural entity", () => {
    const app = makeStructural({ id: "wg-app1", label: "App", name: "MyApp" });
    const graph = buildGraph([app]);

    expect(graph.order).toBe(1);
    expect(graph.hasNode("wg-app1")).toBe(true);
    expect(graph.getNodeAttribute("wg-app1", "label")).toBe("App");
    expect(graph.getNodeAttribute("wg-app1", "name")).toBe("MyApp");
  });

  it("derives a COMPOSES edge from parent field (parent → child)", () => {
    const app = makeStructural({ id: "wg-app1", label: "App", name: "MyApp" });
    const feat = makeStructural({ id: "wg-feat1", label: "Feature", name: "Auth", parent: "wg-app1" });

    const graph = buildGraph([app, feat]);

    expect(graph.size).toBe(1);
    expect(graph.hasEdge("composes-wg-app1-wg-feat1")).toBe(true);
    expect(graph.getEdgeAttribute("composes-wg-app1-wg-feat1", "label")).toBe("COMPOSES");
    expect(graph.source("composes-wg-app1-wg-feat1")).toBe("wg-app1");
    expect(graph.target("composes-wg-app1-wg-feat1")).toBe("wg-feat1");
  });

  it("derives AFFECTS edges from decision affects array", () => {
    const feat = makeStructural({ id: "wg-feat1", label: "Feature", name: "Auth" });
    const comp = makeStructural({ id: "wg-comp1", label: "Component", name: "Login" });
    const dec = makeDecision({ id: "wg-dec1", affects: ["wg-feat1", "wg-comp1"] });

    const graph = buildGraph([feat, comp, dec]);

    expect(graph.hasEdge("affects-wg-dec1-wg-feat1")).toBe(true);
    expect(graph.getEdgeAttribute("affects-wg-dec1-wg-feat1", "label")).toBe("AFFECTS");
    expect(graph.source("affects-wg-dec1-wg-feat1")).toBe("wg-dec1");
    expect(graph.target("affects-wg-dec1-wg-feat1")).toBe("wg-feat1");

    expect(graph.hasEdge("affects-wg-dec1-wg-comp1")).toBe(true);
    expect(graph.source("affects-wg-dec1-wg-comp1")).toBe("wg-dec1");
    expect(graph.target("affects-wg-dec1-wg-comp1")).toBe("wg-comp1");
  });

  it("derives a SUPERSEDES edge from decision supersedes field", () => {
    const oldDec = makeDecision({ id: "wg-old1", affects: ["wg-feat1"], status: "superseded" });
    const feat = makeStructural({ id: "wg-feat1", label: "Feature", name: "Auth" });
    const newDec = makeDecision({ id: "wg-new1", affects: ["wg-feat1"], supersedes: "wg-old1" });

    const graph = buildGraph([oldDec, feat, newDec]);

    expect(graph.hasEdge("supersedes-wg-new1-wg-old1")).toBe(true);
    expect(graph.getEdgeAttribute("supersedes-wg-new1-wg-old1", "label")).toBe("SUPERSEDES");
    expect(graph.source("supersedes-wg-new1-wg-old1")).toBe("wg-new1");
    expect(graph.target("supersedes-wg-new1-wg-old1")).toBe("wg-old1");
  });

  it("skips edges where an endpoint is missing and logs a warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const feat = makeStructural({ id: "wg-feat1", label: "Feature", name: "Auth", parent: "wg-missing" });
    const dec = makeDecision({ id: "wg-dec1", affects: ["wg-ghost"], supersedes: "wg-phantom" });

    const graph = buildGraph([feat, dec]);

    // Nodes should exist
    expect(graph.order).toBe(2);
    // No edges — all endpoints missing
    expect(graph.size).toBe(0);
    // Warnings logged
    expect(warnSpy).toHaveBeenCalledTimes(3); // parent, affects, supersedes
    expect(warnSpy.mock.calls[0][0]).toContain("wg-missing");

    warnSpy.mockRestore();
  });

  it("preserves all entity attributes on graph nodes", () => {
    const node = makeStructural({
      id: "wg-comp1",
      label: "Component",
      name: "SessionManager",
      status: "active",
      parent: "wg-feat1",
      refs: [{ file: "src/session.ts", symbol: "create" }],
      description: "Manages sessions",
    });

    const graph = buildGraph([node]);

    const attrs = graph.getNodeAttributes("wg-comp1");
    expect(attrs.label).toBe("Component");
    expect(attrs.name).toBe("SessionManager");
    expect(attrs.status).toBe("active");
    expect(attrs.parent).toBe("wg-feat1");
    expect(attrs.refs).toEqual([{ file: "src/session.ts", symbol: "create" }]);
    expect(attrs.description).toBe("Manages sessions");
    expect(attrs.created_at).toBe("2026-03-24T00:00:00Z");
  });

  it("handles a complex multi-entity scenario", () => {
    const app = makeStructural({ id: "wg-app1", label: "App", name: "MyApp" });
    const feat = makeStructural({ id: "wg-feat1", label: "Feature", name: "Auth", parent: "wg-app1" });
    const comp = makeStructural({ id: "wg-comp1", label: "Component", name: "Login", parent: "wg-feat1" });
    const dec1 = makeDecision({ id: "wg-dec1", affects: ["wg-feat1", "wg-comp1"] });
    const dec2 = makeDecision({ id: "wg-dec2", affects: ["wg-feat1"], supersedes: "wg-dec1" });

    const graph = buildGraph([app, feat, comp, dec1, dec2]);

    // 5 nodes
    expect(graph.order).toBe(5);
    // 2 COMPOSES + 2 AFFECTS(dec1) + 1 AFFECTS(dec2) + 1 SUPERSEDES = 6
    expect(graph.size).toBe(6);

    // COMPOSES
    expect(graph.hasEdge("composes-wg-app1-wg-feat1")).toBe(true);
    expect(graph.hasEdge("composes-wg-feat1-wg-comp1")).toBe(true);

    // AFFECTS
    expect(graph.hasEdge("affects-wg-dec1-wg-feat1")).toBe(true);
    expect(graph.hasEdge("affects-wg-dec1-wg-comp1")).toBe(true);
    expect(graph.hasEdge("affects-wg-dec2-wg-feat1")).toBe(true);

    // SUPERSEDES
    expect(graph.hasEdge("supersedes-wg-dec2-wg-dec1")).toBe(true);
  });
});
