import { describe, it, expect } from "vitest";
import { computeDerivedState } from "../../src/server/derived.js";
import type {
  Entity,
  StructuralNode,
  DecisionNode,
} from "../../src/entity/types.js";

function makeStructural(
  overrides: Partial<StructuralNode> & { id: string },
): StructuralNode {
  return {
    label: "Feature",
    name: "TestFeature",
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

function toMap(entities: Entity[]): Map<string, Entity> {
  return new Map(entities.map((e) => [e.id, e]));
}

describe("computeDerivedState", () => {
  it("returns no errors for valid entities", () => {
    const feat = makeStructural({ id: "wg-feat1", parent: "wg-app1" });
    const state = computeDerivedState(toMap([feat]));

    expect(state.validationErrors.size).toBe(0);
  });

  it("collects validation errors per entity", () => {
    const bad1 = makeStructural({ id: "", name: "BadOne" });
    const bad2 = makeStructural({ id: "wg-bad2", name: "" });
    const good = makeStructural({ id: "wg-good", parent: "wg-app1" });

    const state = computeDerivedState(toMap([bad1, bad2, good]));

    // bad1 has empty id
    expect(state.validationErrors.has("")).toBe(true);
    // bad2 has empty name
    expect(state.validationErrors.has("wg-bad2")).toBe(true);
    // good has no errors
    expect(state.validationErrors.has("wg-good")).toBe(false);
  });

  it("detects supersede candidates", () => {
    const feat = makeStructural({ id: "wg-feat1", parent: "wg-app1" });
    const dec1 = makeDecision({
      id: "wg-dec1",
      affects: ["wg-feat1"],
      created_at: "2026-03-20T00:00:00Z",
    });
    const dec2 = makeDecision({
      id: "wg-dec2",
      affects: ["wg-feat1"],
      created_at: "2026-03-24T00:00:00Z",
    });

    const state = computeDerivedState(toMap([feat, dec1, dec2]));

    expect(state.supersedeCandidates.length).toBe(1);
    expect(state.supersedeCandidates[0].sharedNodeIds).toContain("wg-feat1");
  });

  it("returns empty state for empty map", () => {
    const state = computeDerivedState(new Map());

    expect(state.validationErrors.size).toBe(0);
    expect(state.supersedeCandidates).toEqual([]);
  });
});
