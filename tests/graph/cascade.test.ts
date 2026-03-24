import { describe, it, expect } from "vitest";
import { cascadeRemoval } from "../../src/graph/cascade.js";
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

function toMap(entities: Entity[]): Map<string, Entity> {
  return new Map(entities.map((e) => [e.id, e]));
}

describe("cascadeRemoval", () => {
  it("finds recursive children via COMPOSES edges", () => {
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
    });

    const result = cascadeRemoval(
      toMap([app, feat, comp]),
      "wg-app1",
      "2026-03-24T12:00:00Z",
    );

    expect(result.removedIds).toContain("wg-app1");
    expect(result.removedIds).toContain("wg-feat1");
    expect(result.removedIds).toContain("wg-comp1");
    expect(result.removedIds).toHaveLength(3);
  });

  it("identifies orphaned decisions when all affects targets are removed", () => {
    const feat = makeStructural({
      id: "wg-feat1",
      label: "Feature",
      name: "Auth",
    });
    const dec = makeDecision({ id: "wg-dec1", affects: ["wg-feat1"] });

    const result = cascadeRemoval(
      toMap([feat, dec]),
      "wg-feat1",
      "2026-03-24T12:00:00Z",
    );

    expect(result.removedIds).toEqual(["wg-feat1"]);
    expect(result.orphanedDecisionIds).toEqual(["wg-dec1"]);
    expect(result.partialDecisionPatches).toEqual([]);
  });

  it("returns remaining affects for partial decisions", () => {
    const feat1 = makeStructural({
      id: "wg-feat1",
      label: "Feature",
      name: "Auth",
    });
    const feat2 = makeStructural({
      id: "wg-feat2",
      label: "Feature",
      name: "Billing",
    });
    const dec = makeDecision({
      id: "wg-dec1",
      affects: ["wg-feat1", "wg-feat2"],
    });

    const result = cascadeRemoval(
      toMap([feat1, feat2, dec]),
      "wg-feat1",
      "2026-03-24T12:00:00Z",
    );

    expect(result.removedIds).toEqual(["wg-feat1"]);
    expect(result.orphanedDecisionIds).toEqual([]);
    expect(result.partialDecisionPatches).toEqual([
      { id: "wg-dec1", remainingAffects: ["wg-feat2"] },
    ]);
  });

  it("returns only the target node when it has no children", () => {
    const feat = makeStructural({
      id: "wg-feat1",
      label: "Feature",
      name: "Auth",
    });

    const result = cascadeRemoval(
      toMap([feat]),
      "wg-feat1",
      "2026-03-24T12:00:00Z",
    );

    expect(result.removedIds).toEqual(["wg-feat1"]);
    expect(result.orphanedDecisionIds).toEqual([]);
    expect(result.partialDecisionPatches).toEqual([]);
  });

  it("excludes already-removed decisions from orphan check", () => {
    const feat = makeStructural({
      id: "wg-feat1",
      label: "Feature",
      name: "Auth",
    });
    const dec = makeDecision({
      id: "wg-dec1",
      affects: ["wg-feat1"],
      removed_at: "2026-03-20T00:00:00Z",
    });

    const result = cascadeRemoval(
      toMap([feat, dec]),
      "wg-feat1",
      "2026-03-24T12:00:00Z",
    );

    expect(result.orphanedDecisionIds).toEqual([]);
  });
});
