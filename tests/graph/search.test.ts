import { describe, it, expect } from "vitest";
import { searchDecisions } from "../../src/graph/search.js";
import type {
  Entity,
  DecisionNode,
  StructuralNode,
} from "../../src/entity/types.js";

// ---- helpers ----

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

function toMap(entities: Entity[]): Map<string, Entity> {
  return new Map(entities.map((e) => [e.id, e]));
}

describe("searchDecisions", () => {
  it("matches by title", () => {
    const dec = makeDecision({
      id: "wg-dec1",
      affects: ["wg-feat1"],
      title: "Use GraphQL for API",
    });

    const result = searchDecisions(toMap([dec]), "GraphQL");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("wg-dec1");
  });

  it("matches by body section (context, decision, tradeoffs, alternatives)", () => {
    const dec = makeDecision({
      id: "wg-dec1",
      affects: ["wg-feat1"],
      context: "We need a caching strategy",
      decision: "Use Redis",
      tradeoffs: "Memory cost",
      alternatives: "Memcached was considered",
    });

    expect(searchDecisions(toMap([dec]), "caching")).toHaveLength(1);
    expect(searchDecisions(toMap([dec]), "Redis")).toHaveLength(1);
    expect(searchDecisions(toMap([dec]), "Memory cost")).toHaveLength(1);
    expect(searchDecisions(toMap([dec]), "Memcached")).toHaveLength(1);
  });

  it("is case-insensitive", () => {
    const dec = makeDecision({
      id: "wg-dec1",
      affects: ["wg-feat1"],
      title: "Use GraphQL",
    });

    expect(searchDecisions(toMap([dec]), "graphql")).toHaveLength(1);
    expect(searchDecisions(toMap([dec]), "GRAPHQL")).toHaveLength(1);
  });

  it("returns empty when nothing matches", () => {
    const dec = makeDecision({
      id: "wg-dec1",
      affects: ["wg-feat1"],
      title: "Use REST",
    });

    expect(searchDecisions(toMap([dec]), "GraphQL")).toEqual([]);
  });

  it("excludes removed decisions", () => {
    const dec = makeDecision({
      id: "wg-dec1",
      affects: ["wg-feat1"],
      title: "Use GraphQL",
      removed_at: "2026-03-22T00:00:00Z",
    });

    expect(searchDecisions(toMap([dec]), "GraphQL")).toEqual([]);
  });

  it("ignores structural nodes", () => {
    const feat = makeStructural({
      id: "wg-feat1",
      label: "Feature",
      name: "GraphQL Feature",
    });

    expect(searchDecisions(toMap([feat]), "GraphQL")).toEqual([]);
  });
});
