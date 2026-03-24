import { describe, it, expect } from "vitest";
import { detectSupersedeCandidates } from "../../src/graph/supersede.js";
import type {
  Entity,
  StructuralNode,
  DecisionNode,
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

function toMap(entities: Entity[]): Map<string, Entity> {
  return new Map(entities.map((e) => [e.id, e]));
}

describe("detectSupersedeCandidates", () => {
  it("returns empty when no decisions overlap", () => {
    const dec1 = makeDecision({ id: "wg-dec1", affects: ["wg-feat1"] });
    const dec2 = makeDecision({ id: "wg-dec2", affects: ["wg-feat2"] });

    const result = detectSupersedeCandidates(toMap([dec1, dec2]));
    expect(result).toEqual([]);
  });

  it("detects overlapping affects as a candidate", () => {
    const dec1 = makeDecision({
      id: "wg-dec1",
      affects: ["wg-feat1", "wg-feat2"],
      created_at: "2026-03-20T00:00:00Z",
    });
    const dec2 = makeDecision({
      id: "wg-dec2",
      affects: ["wg-feat2", "wg-feat3"],
      created_at: "2026-03-24T00:00:00Z",
    });

    const result = detectSupersedeCandidates(toMap([dec1, dec2]));
    expect(result).toHaveLength(1);
    expect(result[0].newDecisionId).toBe("wg-dec2");
    expect(result[0].existingDecisionId).toBe("wg-dec1");
    expect(result[0].sharedNodeIds).toEqual(["wg-feat2"]);
  });

  it("excludes pairs that already have a supersedes relationship", () => {
    const dec1 = makeDecision({
      id: "wg-dec1",
      affects: ["wg-feat1"],
      status: "superseded",
      created_at: "2026-03-20T00:00:00Z",
    });
    const dec2 = makeDecision({
      id: "wg-dec2",
      affects: ["wg-feat1"],
      supersedes: "wg-dec1",
      created_at: "2026-03-24T00:00:00Z",
    });

    // dec1 is superseded so it won't be active — but let's test the
    // supersedes exclusion with both active
    const decA = makeDecision({
      id: "wg-decA",
      affects: ["wg-feat1"],
      created_at: "2026-03-20T00:00:00Z",
    });
    const decB = makeDecision({
      id: "wg-decB",
      affects: ["wg-feat1"],
      supersedes: "wg-decA",
      created_at: "2026-03-24T00:00:00Z",
    });

    const result = detectSupersedeCandidates(toMap([decA, decB]));
    expect(result).toEqual([]);
  });

  it("excludes removed decisions", () => {
    const dec1 = makeDecision({
      id: "wg-dec1",
      affects: ["wg-feat1"],
      removed_at: "2026-03-22T00:00:00Z",
    });
    const dec2 = makeDecision({
      id: "wg-dec2",
      affects: ["wg-feat1"],
    });

    const result = detectSupersedeCandidates(toMap([dec1, dec2]));
    expect(result).toEqual([]);
  });

  it("excludes superseded-status decisions", () => {
    const dec1 = makeDecision({
      id: "wg-dec1",
      affects: ["wg-feat1"],
      status: "superseded",
    });
    const dec2 = makeDecision({
      id: "wg-dec2",
      affects: ["wg-feat1"],
    });

    const result = detectSupersedeCandidates(toMap([dec1, dec2]));
    expect(result).toEqual([]);
  });
});
