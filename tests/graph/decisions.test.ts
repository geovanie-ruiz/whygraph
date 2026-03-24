import { describe, it, expect } from "vitest";
import { MultiDirectedGraph } from "graphology";
import { buildGraph } from "../../src/graph/projection.js";
import { getDecisions } from "../../src/graph/decisions.js";
import type {
  DecisionNode,
  StructuralNode,
} from "../../src/entity/types.js";

// ---- helpers ----

function makeStructural(
  overrides: Partial<StructuralNode> & { id: string; label: StructuralNode["label"]; name: string },
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

describe("getDecisions", () => {
  const feat = makeStructural({ id: "wg-feat1", label: "Feature", name: "Auth" });

  it("returns all active decisions when no filters provided", () => {
    const d1 = makeDecision({ id: "wg-dec1", affects: ["wg-feat1"] });
    const d2 = makeDecision({ id: "wg-dec2", affects: ["wg-feat1"], title: "Second" });

    const graph = buildGraph([feat, d1, d2]);
    const results = getDecisions(graph);

    expect(results).toHaveLength(2);
    expect(results.map((d) => d.id)).toContain("wg-dec1");
    expect(results.map((d) => d.id)).toContain("wg-dec2");
  });

  it("filters by status", () => {
    const active = makeDecision({ id: "wg-dec1", affects: ["wg-feat1"], status: "active" });
    const superseded = makeDecision({ id: "wg-dec2", affects: ["wg-feat1"], status: "superseded" });

    const graph = buildGraph([feat, active, superseded]);
    const results = getDecisions(graph, { status: "superseded" });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("wg-dec2");
  });

  it("filters by a single tag (OR logic)", () => {
    const d1 = makeDecision({ id: "wg-dec1", affects: ["wg-feat1"], tags: ["arch"] });
    const d2 = makeDecision({ id: "wg-dec2", affects: ["wg-feat1"], tags: ["security"] });

    const graph = buildGraph([feat, d1, d2]);
    const results = getDecisions(graph, { tags: ["security"] });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("wg-dec2");
  });

  it("filters by multiple tags with OR logic (any match counts)", () => {
    const d1 = makeDecision({ id: "wg-dec1", affects: ["wg-feat1"], tags: ["arch"] });
    const d2 = makeDecision({ id: "wg-dec2", affects: ["wg-feat1"], tags: ["security"] });
    const d3 = makeDecision({ id: "wg-dec3", affects: ["wg-feat1"], tags: ["data"] });

    const graph = buildGraph([feat, d1, d2, d3]);
    const results = getDecisions(graph, { tags: ["arch", "security"] });

    expect(results).toHaveLength(2);
    const ids = results.map((d) => d.id);
    expect(ids).toContain("wg-dec1");
    expect(ids).toContain("wg-dec2");
  });

  it("filters by date range (dateFrom)", () => {
    const d1 = makeDecision({ id: "wg-dec1", affects: ["wg-feat1"], date: "2026-01-15" });
    const d2 = makeDecision({ id: "wg-dec2", affects: ["wg-feat1"], date: "2026-03-20" });

    const graph = buildGraph([feat, d1, d2]);
    const results = getDecisions(graph, { dateFrom: "2026-03-01" });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("wg-dec2");
  });

  it("filters by date range (dateTo)", () => {
    const d1 = makeDecision({ id: "wg-dec1", affects: ["wg-feat1"], date: "2026-01-15" });
    const d2 = makeDecision({ id: "wg-dec2", affects: ["wg-feat1"], date: "2026-03-20" });

    const graph = buildGraph([feat, d1, d2]);
    const results = getDecisions(graph, { dateTo: "2026-02-01" });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("wg-dec1");
  });

  it("filters by full date range (dateFrom and dateTo)", () => {
    const d1 = makeDecision({ id: "wg-dec1", affects: ["wg-feat1"], date: "2026-01-15" });
    const d2 = makeDecision({ id: "wg-dec2", affects: ["wg-feat1"], date: "2026-03-20" });
    const d3 = makeDecision({ id: "wg-dec3", affects: ["wg-feat1"], date: "2026-06-01" });

    const graph = buildGraph([feat, d1, d2, d3]);
    const results = getDecisions(graph, { dateFrom: "2026-02-01", dateTo: "2026-04-01" });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("wg-dec2");
  });

  it("combines filters with AND logic between filter types", () => {
    const d1 = makeDecision({
      id: "wg-dec1",
      affects: ["wg-feat1"],
      status: "active",
      tags: ["arch"],
      date: "2026-03-20",
    });
    const d2 = makeDecision({
      id: "wg-dec2",
      affects: ["wg-feat1"],
      status: "active",
      tags: ["security"],
      date: "2026-03-20",
    });
    const d3 = makeDecision({
      id: "wg-dec3",
      affects: ["wg-feat1"],
      status: "superseded",
      tags: ["arch"],
      date: "2026-03-20",
    });
    const d4 = makeDecision({
      id: "wg-dec4",
      affects: ["wg-feat1"],
      status: "active",
      tags: ["arch"],
      date: "2026-01-10",
    });

    const graph = buildGraph([feat, d1, d2, d3, d4]);
    const results = getDecisions(graph, {
      status: "active",
      tags: ["arch"],
      dateFrom: "2026-03-01",
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("wg-dec1");
  });

  it("excludes removed decisions (removed_at set)", () => {
    const d1 = makeDecision({ id: "wg-dec1", affects: ["wg-feat1"] });
    const d2 = makeDecision({
      id: "wg-dec2",
      affects: ["wg-feat1"],
      removed_at: "2026-03-24T00:00:00Z",
    });

    const graph = buildGraph([feat, d1, d2]);
    const results = getDecisions(graph);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("wg-dec1");
  });

  it("excludes removed decisions even when filters match", () => {
    const d1 = makeDecision({
      id: "wg-dec1",
      affects: ["wg-feat1"],
      tags: ["arch"],
      removed_at: "2026-03-24T00:00:00Z",
    });

    const graph = buildGraph([feat, d1]);
    const results = getDecisions(graph, { tags: ["arch"] });

    expect(results).toHaveLength(0);
  });

  it("does not include structural nodes in results", () => {
    const app = makeStructural({ id: "wg-app1", label: "App", name: "MyApp" });
    const d1 = makeDecision({ id: "wg-dec1", affects: ["wg-app1"] });

    const graph = buildGraph([app, d1]);
    const results = getDecisions(graph);

    expect(results).toHaveLength(1);
    expect(results[0].label).toBe("Decision");
  });
});
