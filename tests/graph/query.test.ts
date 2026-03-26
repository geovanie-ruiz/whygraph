import { describe, it, expect } from "vitest";
import { MultiDirectedGraph } from "graphology";
import { buildGraph } from "../../src/graph/projection.js";
import { getContext } from "../../src/graph/query.js";
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

describe("getContext", () => {
  it("returns empty result when no refs match the file path", () => {
    const app = makeStructural({ id: "wg-app1", label: "App", name: "MyApp" });
    const comp = makeStructural({
      id: "wg-comp1",
      label: "Component",
      name: "Login",
      refs: [{ file: "src/login.ts" }],
    });
    const graph = buildGraph([app, comp]);

    const result = getContext(graph, "src/other.ts");

    expect(result.nodes).toEqual([]);
    expect(result.decisions).toEqual([]);
  });

  it("returns matching node when file path matches a ref", () => {
    const app = makeStructural({ id: "wg-app1", label: "App", name: "MyApp" });
    const comp = makeStructural({
      id: "wg-comp1",
      label: "Component",
      name: "Login",
      parent: "wg-app1",
      refs: [{ file: "src/login.ts" }],
    });
    const graph = buildGraph([app, comp]);

    const result = getContext(graph, "src/login.ts");

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe("wg-comp1");
    expect(result.nodes[0].label).toBe("Component");
    expect(result.nodes[0].name).toBe("Login");
  });

  it("collects decisions via AFFECTS edges on matched nodes", () => {
    const app = makeStructural({ id: "wg-app1", label: "App", name: "MyApp" });
    const comp = makeStructural({
      id: "wg-comp1",
      label: "Component",
      name: "Login",
      parent: "wg-app1",
      refs: [{ file: "src/login.ts" }],
    });
    const dec = makeDecision({
      id: "wg-dec1",
      title: "Use JWT",
      affects: ["wg-comp1"],
    });
    const graph = buildGraph([app, comp, dec]);

    const result = getContext(graph, "src/login.ts");

    expect(result.nodes).toHaveLength(1);
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0].id).toBe("wg-dec1");
    expect(result.decisions[0].title).toBe("Use JWT");
  });

  it("traverses parent chain and includes ancestor decisions", () => {
    const app = makeStructural({ id: "wg-app1", label: "App", name: "MyApp" });
    const feat = makeStructural({
      id: "wg-feat1",
      label: "Feature",
      name: "Auth",
      parent: "wg-app1",
    });
    const comp = makeStructural({
      id: "wg-comp1",
      label: "Component",
      name: "Login",
      parent: "wg-feat1",
      refs: [{ file: "src/login.ts" }],
    });
    const decOnComp = makeDecision({
      id: "wg-dec1",
      title: "Use JWT",
      affects: ["wg-comp1"],
    });
    const decOnFeat = makeDecision({
      id: "wg-dec2",
      title: "OAuth Provider",
      affects: ["wg-feat1"],
    });
    const decOnApp = makeDecision({
      id: "wg-dec3",
      title: "Monorepo",
      affects: ["wg-app1"],
    });
    const graph = buildGraph([app, feat, comp, decOnComp, decOnFeat, decOnApp]);

    const result = getContext(graph, "src/login.ts");

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe("wg-comp1");
    expect(result.nodes[0].parentChain).toEqual(["wg-feat1", "wg-app1"]);

    const decisionIds = result.decisions.map((d) => d.id).sort();
    expect(decisionIds).toEqual(["wg-dec1", "wg-dec2", "wg-dec3"]);
  });

  it("matches refs with symbol when symbol is provided", () => {
    const comp = makeStructural({
      id: "wg-comp1",
      label: "Component",
      name: "Login",
      refs: [
        { file: "src/login.ts", symbol: "authenticate" },
        { file: "src/login.ts", symbol: "logout" },
        { file: "src/other.ts", symbol: "helper" },
      ],
    });
    const graph = buildGraph([comp]);

    const result = getContext(graph, "src/login.ts", "authenticate");

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe("wg-comp1");
  });

  it("includes file-level refs even when symbol is specified", () => {
    const compFileLevel = makeStructural({
      id: "wg-comp1",
      label: "Component",
      name: "Login",
      refs: [{ file: "src/login.ts" }],
    });
    const compSymbol = makeStructural({
      id: "wg-comp2",
      label: "Component",
      name: "Session",
      refs: [{ file: "src/login.ts", symbol: "createSession" }],
    });
    const compOtherSymbol = makeStructural({
      id: "wg-comp3",
      label: "Component",
      name: "Other",
      refs: [{ file: "src/login.ts", symbol: "unrelated" }],
    });
    const graph = buildGraph([compFileLevel, compSymbol, compOtherSymbol]);

    const result = getContext(graph, "src/login.ts", "createSession");

    const nodeIds = result.nodes.map((n) => n.id).sort();
    // comp1 (file-level) and comp2 (matching symbol) included, comp3 (wrong symbol) excluded
    expect(nodeIds).toEqual(["wg-comp1", "wg-comp2"]);
  });
});
