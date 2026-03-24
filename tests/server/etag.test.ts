import { describe, it, expect } from "vitest";
import { computeETag, isDirty } from "../../src/server/etag.js";
import type { StructuralNode, DecisionNode } from "../../src/entity/types.js";

function makeNode(overrides: Partial<StructuralNode> = {}): StructuralNode {
  return {
    id: "wg-test",
    label: "Feature",
    name: "TestFeature",
    status: "active",
    created_at: "2026-03-24T00:00:00Z",
    updated_at: "2026-03-24T00:00:00Z",
    ...overrides,
  };
}

function makeDecision(overrides: Partial<DecisionNode> = {}): DecisionNode {
  return {
    id: "wg-dec1",
    label: "Decision",
    title: "Use JWT",
    status: "active",
    date: "2026-03-24",
    affects: ["wg-test"],
    tags: ["security"],
    context: "Need authentication",
    decision: "Use JWT tokens",
    tradeoffs: "Token size vs simplicity",
    alternatives: "Server sessions",
    created_at: "2026-03-24T00:00:00Z",
    updated_at: "2026-03-24T00:00:00Z",
    ...overrides,
  };
}

describe("computeETag", () => {
  it("same entity produces same ETag", () => {
    const node = makeNode();
    expect(computeETag(node)).toBe(computeETag(node));
  });

  it("identical entities produce same ETag", () => {
    const node1 = makeNode();
    const node2 = makeNode();
    expect(computeETag(node1)).toBe(computeETag(node2));
  });

  it("different entity produces different ETag", () => {
    const node1 = makeNode({ name: "FeatureA" });
    const node2 = makeNode({ name: "FeatureB" });
    expect(computeETag(node1)).not.toBe(computeETag(node2));
  });

  it("works with decision nodes", () => {
    const dec1 = makeDecision();
    const dec2 = makeDecision({ title: "Use Sessions" });
    expect(computeETag(dec1)).toBe(computeETag(makeDecision()));
    expect(computeETag(dec1)).not.toBe(computeETag(dec2));
  });

  it("returns a hex string", () => {
    const etag = computeETag(makeNode());
    expect(etag).toMatch(/^[0-9a-f]+$/);
  });
});

describe("isDirty", () => {
  it("returns false for identical entities", () => {
    const node = makeNode();
    expect(isDirty(node, node)).toBe(false);
  });

  it("returns true for different entities", () => {
    const worktree = makeNode({ name: "Modified" });
    const main = makeNode({ name: "Original" });
    expect(isDirty(worktree, main)).toBe(true);
  });

  it("returns false when worktree matches main", () => {
    const worktree = makeNode();
    const main = makeNode();
    expect(isDirty(worktree, main)).toBe(false);
  });
});
