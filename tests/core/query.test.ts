import { describe, it, expect } from "vitest";
import { MultiDirectedGraph } from "graphology";
import type {
  WhyEvent,
  NodeAddedEvent,
  EdgeAddedEvent,
  DecisionProperties,
  ContextResult,
} from "../../src/core/types.js";
import { buildGraph } from "../../src/core/projection.js";
import {
  getContext,
  getDecisions,
  getGaps,
  getNodeAttributes,
  getFeatureIds,
} from "../../src/core/query.js";

// ── Helpers ──────────────────────────────────────────────────

function makeNodeAdded(
  id: string,
  label: "App" | "Feature" | "Component" | "Decision",
  properties: Record<string, unknown>,
  timestamp: string = "2026-03-22T00:00:00Z"
): NodeAddedEvent {
  return {
    type: "node_added",
    timestamp,
    id,
    label,
    properties: properties as never,
  };
}

function makeEdgeAdded(
  id: string,
  from: string,
  to: string,
  label: "COMPOSES" | "AFFECTS" | "SUPERSEDES" | "DEPRECATES" = "COMPOSES",
  timestamp: string = "2026-03-22T00:00:00Z"
): EdgeAddedEvent {
  return {
    type: "edge_added",
    timestamp,
    id,
    label,
    from,
    to,
  };
}

/**
 * Build a standard test graph:
 *
 * app-1 (App)
 *   └─COMPOSES─> feat-1 (Feature, refs: [src/core/query.ts])
 *       └─COMPOSES─> comp-1 (Component, refs: [src/core/query.ts, queryFn])
 *       └─COMPOSES─> comp-2 (Component, refs: [src/core/other.ts])
 *   └─COMPOSES─> feat-2 (Feature, no refs)
 *       └─COMPOSES─> comp-3 (Component, refs: [src/core/deep.ts])
 *
 * dec-1 (Decision, active, tags: [arch], date: 2026-01-15)
 *   └─AFFECTS─> comp-1
 * dec-2 (Decision, superseded, tags: [data, security], date: 2026-02-20)
 *   └─AFFECTS─> comp-1
 *   └─AFFECTS─> feat-1
 * dec-3 (Decision, active, tags: [ux], date: 2026-03-10)
 *   └─AFFECTS─> comp-2
 */
function buildTestGraph(): MultiDirectedGraph {
  const events: WhyEvent[] = [
    makeNodeAdded("app-1", "App", { name: "TestApp" }),
    makeNodeAdded("feat-1", "Feature", {
      name: "Query",
      refs: [{ file: "src/core/query.ts" }],
    }),
    makeNodeAdded("feat-2", "Feature", { name: "Other Feature" }),
    makeNodeAdded("comp-1", "Component", {
      name: "QueryEngine",
      refs: [{ file: "src/core/query.ts", symbol: "queryFn" }],
    }),
    makeNodeAdded("comp-2", "Component", {
      name: "OtherComp",
      refs: [{ file: "src/core/other.ts" }],
    }),
    makeNodeAdded("comp-3", "Component", {
      name: "DeepComp",
      refs: [{ file: "src/core/deep.ts" }],
    }),
    makeNodeAdded("dec-1", "Decision", {
      title: "Use graphology",
      date: "2026-01-15",
      context: "Need a graph lib",
      decision: "Use graphology",
      tradeoffs: "Heavy but powerful",
      alternatives: "Custom impl",
      status: "active",
      affects: ["comp-1"],
      tags: ["arch"],
    }),
    makeNodeAdded("dec-2", "Decision", {
      title: "JSON schema",
      date: "2026-02-20",
      context: "Data format",
      decision: "Use JSON",
      tradeoffs: "Verbose",
      alternatives: "YAML",
      status: "superseded",
      affects: ["comp-1", "feat-1"],
      tags: ["data", "security"],
    }),
    makeNodeAdded("dec-3", "Decision", {
      title: "Dark mode",
      date: "2026-03-10",
      context: "UX req",
      decision: "Support dark mode",
      tradeoffs: "More CSS",
      alternatives: "Light only",
      status: "active",
      affects: ["comp-2"],
      tags: ["ux"],
    }),
    // Edges: COMPOSES hierarchy
    makeEdgeAdded("e-1", "app-1", "feat-1", "COMPOSES"),
    makeEdgeAdded("e-2", "app-1", "feat-2", "COMPOSES"),
    makeEdgeAdded("e-3", "feat-1", "comp-1", "COMPOSES"),
    makeEdgeAdded("e-4", "feat-1", "comp-2", "COMPOSES"),
    makeEdgeAdded("e-5", "feat-2", "comp-3", "COMPOSES"),
    // Edges: AFFECTS
    makeEdgeAdded("e-6", "dec-1", "comp-1", "AFFECTS"),
    makeEdgeAdded("e-7", "dec-2", "comp-1", "AFFECTS"),
    makeEdgeAdded("e-8", "dec-2", "feat-1", "AFFECTS"),
    makeEdgeAdded("e-9", "dec-3", "comp-2", "AFFECTS"),
  ];
  return buildGraph(events);
}

// ── getContext ────────────────────────────────────────────────

describe("getContext", () => {
  it("returns correct nodes and decisions for a known file ref", () => {
    const graph = buildTestGraph();
    const result = getContext(graph, "src/core/query.ts");

    expect(result).not.toBeNull();
    const r = result as ContextResult;

    // Should match both feat-1 and comp-1 (both have refs to this file)
    const nodeIds = r.nodes.map((n) => n.id).sort();
    expect(nodeIds).toContain("comp-1");
    expect(nodeIds).toContain("feat-1");

    // Decisions affecting matched nodes or their parents
    const decIds = r.decisions.map((d) => d.id).sort();
    expect(decIds).toContain("dec-1"); // affects comp-1
    expect(decIds).toContain("dec-2"); // affects comp-1 and feat-1
    // dec-3 affects comp-2 which is NOT matched by this file — not included
    expect(decIds).not.toContain("dec-3");
  });

  it("traverses COMPOSES upward to return parent chain", () => {
    const graph = buildTestGraph();
    const result = getContext(graph, "src/core/query.ts");

    expect(result).not.toBeNull();
    const r = result as ContextResult;

    const comp1Node = r.nodes.find((n) => n.id === "comp-1");
    expect(comp1Node).toBeDefined();
    // comp-1's parent chain: feat-1 -> app-1
    expect(comp1Node!.parentChain).toEqual(["feat-1", "app-1"]);
  });

  it("returns null for unknown file", () => {
    const graph = buildTestGraph();
    const result = getContext(graph, "src/nonexistent.ts");
    expect(result).toBeNull();
  });

  it("filters by symbol when provided", () => {
    const graph = buildTestGraph();

    // With symbol match
    const withSymbol = getContext(graph, "src/core/query.ts", "queryFn");
    expect(withSymbol).not.toBeNull();
    const nodeIds = withSymbol!.nodes.map((n) => n.id);
    expect(nodeIds).toContain("comp-1"); // has symbol queryFn
    // feat-1 has the file but no symbol — should still be included (file match)
    expect(nodeIds).toContain("feat-1");

    // With non-matching symbol — still matches file-only refs
    const noSymbol = getContext(graph, "src/core/query.ts", "nonexistent");
    expect(noSymbol).not.toBeNull();
    // feat-1 matches on file alone (no symbol in ref), comp-1 does not match (has different symbol)
    const ids = noSymbol!.nodes.map((n) => n.id);
    expect(ids).toContain("feat-1");
    expect(ids).not.toContain("comp-1");
  });
});

// ── getDecisions ─────────────────────────────────────────────

describe("getDecisions", () => {
  it("with no filters returns all decision IDs", () => {
    const graph = buildTestGraph();
    const ids = getDecisions(graph, {});
    expect(ids.sort()).toEqual(["dec-1", "dec-2", "dec-3"]);
  });

  it("filters by status correctly", () => {
    const graph = buildTestGraph();

    const active = getDecisions(graph, { status: "active" });
    expect(active.sort()).toEqual(["dec-1", "dec-3"]);

    const superseded = getDecisions(graph, { status: "superseded" });
    expect(superseded).toEqual(["dec-2"]);
  });

  it("filters by tags with OR logic", () => {
    const graph = buildTestGraph();

    const archOrUx = getDecisions(graph, { tags: ["arch", "ux"] });
    expect(archOrUx.sort()).toEqual(["dec-1", "dec-3"]);

    const data = getDecisions(graph, { tags: ["data"] });
    expect(data).toEqual(["dec-2"]);

    const security = getDecisions(graph, { tags: ["security"] });
    expect(security).toEqual(["dec-2"]);
  });

  it("filters by date range (after/before on date property)", () => {
    const graph = buildTestGraph();

    // After 2026-02-01 — dec-2 and dec-3
    const afterFeb = getDecisions(graph, { after: "2026-02-01" });
    expect(afterFeb.sort()).toEqual(["dec-2", "dec-3"]);

    // Before 2026-03-01 — dec-1 and dec-2
    const beforeMar = getDecisions(graph, { before: "2026-03-01" });
    expect(beforeMar.sort()).toEqual(["dec-1", "dec-2"]);

    // Combined: after 2026-02-01 AND before 2026-03-01 — dec-2 only
    const range = getDecisions(graph, {
      after: "2026-02-01",
      before: "2026-03-01",
    });
    expect(range).toEqual(["dec-2"]);
  });

  it("combines status and tags filters with AND between groups", () => {
    const graph = buildTestGraph();

    // active AND (data OR security) — dec-2 is superseded, so empty
    const result = getDecisions(graph, {
      status: "active",
      tags: ["data", "security"],
    });
    expect(result).toEqual([]);
  });
});

// ── getGaps ──────────────────────────────────────────────────

describe("getGaps", () => {
  it("returns nodes with no inbound AFFECTS edges", () => {
    const graph = buildTestGraph();
    const gaps = getGaps(graph);

    // feat-2, comp-3 have no AFFECTS edges. feat-1 has AFFECTS from dec-2.
    // comp-1 and comp-2 have AFFECTS edges.
    const gapIds = gaps.map((n) => n.id);
    expect(gapIds).toContain("feat-2");
    expect(gapIds).toContain("comp-3");
    expect(gapIds).not.toContain("comp-1");
    expect(gapIds).not.toContain("comp-2");
    expect(gapIds).not.toContain("feat-1");
  });

  it("orders hierarchically (features first)", () => {
    const graph = buildTestGraph();
    const gaps = getGaps(graph);

    const gapIds = gaps.map((n) => n.id);
    const feat2Idx = gapIds.indexOf("feat-2");
    const comp3Idx = gapIds.indexOf("comp-3");
    expect(feat2Idx).toBeLessThan(comp3Idx);
  });

  it("respects limit parameter", () => {
    const graph = buildTestGraph();
    const gaps = getGaps(graph, 1);
    expect(gaps).toHaveLength(1);
  });

  it("does not include App nodes", () => {
    const graph = buildTestGraph();
    const gaps = getGaps(graph);
    const labels = gaps.map((n) => n.label);
    expect(labels).not.toContain("App");
  });

  it("does not include Decision nodes", () => {
    const graph = buildTestGraph();
    const gaps = getGaps(graph);
    const labels = gaps.map((n) => n.label);
    expect(labels).not.toContain("Decision");
  });
});

// ── getFeatureIds ────────────────────────────────────────────

describe("getFeatureIds", () => {
  it("returns all feature IDs", () => {
    const graph = buildTestGraph();
    const ids = getFeatureIds(graph);
    expect(ids.sort()).toEqual(["feat-1", "feat-2"]);
  });

  it("returns empty array for graph with no features", () => {
    const graph = new MultiDirectedGraph();
    graph.addNode("app-1", { label: "App", name: "TestApp" });
    const ids = getFeatureIds(graph);
    expect(ids).toEqual([]);
  });
});

// ── getNodeAttributes ────────────────────────────────────────

describe("getNodeAttributes", () => {
  it("returns full attributes for known node", () => {
    const graph = buildTestGraph();
    const attrs = getNodeAttributes(graph, "feat-1");
    expect(attrs).not.toBeNull();
    expect(attrs!.name).toBe("Query");
    expect(attrs!.label).toBe("Feature");
    expect(attrs!.refs).toEqual([{ file: "src/core/query.ts" }]);
  });

  it("returns null for unknown node", () => {
    const graph = buildTestGraph();
    const attrs = getNodeAttributes(graph, "nonexistent");
    expect(attrs).toBeNull();
  });
});
