import { describe, it, expect } from "vitest";
import { validateEntity } from "../../src/entity/validate.js";
import type { ValidationResult } from "../../src/entity/validate.js";
import type {
  StructuralNode,
  DecisionNode,
  Entity,
} from "../../src/entity/types.js";

// ============================================================
// Helpers
// ============================================================

function makeStructuralNode(overrides: Partial<StructuralNode> = {}): StructuralNode {
  return {
    id: "wg-a1b2",
    label: "Feature",
    name: "Authentication",
    status: "active",
    parent: "wg-app1",
    created_at: "2026-03-24T00:00:00Z",
    updated_at: "2026-03-24T00:00:00Z",
    ...overrides,
  };
}

function makeDecisionNode(overrides: Partial<DecisionNode> = {}): DecisionNode {
  return {
    id: "wg-c3d4",
    label: "Decision",
    title: "Use WebSockets for live updates",
    status: "active",
    date: "2026-03-24",
    affects: ["wg-a1b2"],
    tags: ["arch"],
    context: "Need real-time updates.",
    decision: "Use WebSocket subscriptions.",
    tradeoffs: "Gained: real-time. Lost: complexity.",
    alternatives: "Polling — rejected: latency.",
    created_at: "2026-03-24T10:00:00Z",
    updated_at: "2026-03-24T10:00:00Z",
    ...overrides,
  };
}

function errorFields(result: ValidationResult): string[] {
  return result.errors.filter((e) => e.severity === "error").map((e) => e.field);
}

function warningFields(result: ValidationResult): string[] {
  return result.errors.filter((e) => e.severity === "warning").map((e) => e.field);
}

// ============================================================
// Tests
// ============================================================

describe("validateEntity", () => {
  // 1. Valid structural node passes
  it("accepts a valid structural node", () => {
    const result = validateEntity(makeStructuralNode());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // 2. Valid decision node passes
  it("accepts a valid decision node", () => {
    const result = validateEntity(makeDecisionNode());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // 3. Missing required fields on structural node
  it("rejects structural node with missing name", () => {
    const result = validateEntity(makeStructuralNode({ name: "" }));
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("name");
  });

  it("rejects structural node with missing id", () => {
    const result = validateEntity(makeStructuralNode({ id: "" }));
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("id");
  });

  // 4. Missing required fields on decision node
  it("rejects decision node with missing title", () => {
    const result = validateEntity(makeDecisionNode({ title: "" }));
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("title");
  });

  it("rejects decision node with empty affects", () => {
    const result = validateEntity(makeDecisionNode({ affects: [] }));
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("affects");
  });

  it("rejects decision node with missing context", () => {
    const result = validateEntity(makeDecisionNode({ context: "" }));
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("context");
  });

  it("rejects decision node with missing decision text", () => {
    const result = validateEntity(makeDecisionNode({ decision: "" }));
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("decision");
  });

  it("rejects decision node with missing tradeoffs", () => {
    const result = validateEntity(makeDecisionNode({ tradeoffs: "" }));
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("tradeoffs");
  });

  it("rejects decision node with missing alternatives", () => {
    const result = validateEntity(makeDecisionNode({ alternatives: "" }));
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("alternatives");
  });

  // 5. Invalid tag value
  it("rejects decision node with invalid tag", () => {
    const result = validateEntity(
      makeDecisionNode({ tags: ["arch", "bogus" as never] }),
    );
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("tags");
    expect(result.errors.find((e) => e.field === "tags")!.message).toContain("bogus");
  });

  // 6. Invalid date format
  it("rejects decision node with invalid date format", () => {
    const result = validateEntity(makeDecisionNode({ date: "March 24, 2026" }));
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("date");
  });

  it("rejects decision node with ISO timestamp in date field", () => {
    const result = validateEntity(makeDecisionNode({ date: "2026-03-24T00:00:00Z" }));
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("date");
  });

  // 7. Invalid timestamp format
  it("rejects entity with invalid created_at timestamp", () => {
    const result = validateEntity(makeStructuralNode({ created_at: "2026-03-24" }));
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("created_at");
  });

  it("rejects entity with invalid updated_at timestamp", () => {
    const result = validateEntity(makeStructuralNode({ updated_at: "not-a-date" }));
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("updated_at");
  });

  it("rejects entity with invalid removed_at timestamp", () => {
    const result = validateEntity(makeStructuralNode({ removed_at: "bad" }));
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("removed_at");
  });

  // 8. Invalid status for label type
  it("rejects structural node with decision status", () => {
    const node = makeStructuralNode({ status: "superseded" as never });
    const result = validateEntity(node);
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("status");
  });

  it("rejects decision node with structural status", () => {
    const node = makeDecisionNode({ status: "deprecated" as never });
    const result = validateEntity(node);
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("status");
  });

  // 9. App with parent produces warning
  it("warns when App node has a parent", () => {
    const result = validateEntity(makeStructuralNode({ label: "App", parent: "wg-other" }));
    expect(result.valid).toBe(true); // warnings don't make it invalid
    expect(warningFields(result)).toContain("parent");
  });

  // 10. Feature/Component without parent produces warning
  it("warns when Feature node has no parent", () => {
    const node = makeStructuralNode({ label: "Feature" });
    delete (node as Partial<StructuralNode>).parent;
    const result = validateEntity(node);
    expect(result.valid).toBe(true);
    expect(warningFields(result)).toContain("parent");
  });

  it("warns when Component node has no parent", () => {
    const node = makeStructuralNode({ label: "Component" });
    delete (node as Partial<StructuralNode>).parent;
    const result = validateEntity(node);
    expect(result.valid).toBe(true);
    expect(warningFields(result)).toContain("parent");
  });

  // 11. Multiple errors collected
  it("collects multiple errors in one validation", () => {
    const node = makeDecisionNode({
      id: "",
      title: "",
      date: "bad",
      affects: [],
      context: "",
      decision: "",
      tradeoffs: "",
      alternatives: "",
      tags: ["bogus" as never],
      created_at: "bad",
      updated_at: "bad",
    });
    const result = validateEntity(node);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(10);
    expect(errorFields(result)).toContain("id");
    expect(errorFields(result)).toContain("title");
    expect(errorFields(result)).toContain("date");
    expect(errorFields(result)).toContain("affects");
    expect(errorFields(result)).toContain("context");
    expect(errorFields(result)).toContain("decision");
    expect(errorFields(result)).toContain("tradeoffs");
    expect(errorFields(result)).toContain("alternatives");
    expect(errorFields(result)).toContain("tags");
    expect(errorFields(result)).toContain("created_at");
    expect(errorFields(result)).toContain("updated_at");
  });

  // Edge cases
  it("rejects structural node with empty string parent", () => {
    const result = validateEntity(makeStructuralNode({ parent: "" }));
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("parent");
  });

  it("rejects decision node with empty string supersedes", () => {
    const result = validateEntity(makeDecisionNode({ supersedes: "" }));
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("supersedes");
  });

  it("accepts valid removed_at timestamp", () => {
    const result = validateEntity(
      makeStructuralNode({ removed_at: "2026-03-20T00:00:00Z" }),
    );
    expect(result.valid).toBe(true);
  });

  it("accepts ISO 8601 timestamps with timezone offset", () => {
    const result = validateEntity(
      makeStructuralNode({
        created_at: "2026-03-24T10:00:00+05:30",
        updated_at: "2026-03-24T10:00:00-04:00",
      }),
    );
    expect(result.valid).toBe(true);
  });

  it("accepts valid App node without parent", () => {
    const node = makeStructuralNode({ label: "App" });
    delete (node as Partial<StructuralNode>).parent;
    const result = validateEntity(node);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects invalid label", () => {
    const node = makeStructuralNode({ label: "Service" as never });
    const result = validateEntity(node);
    expect(result.valid).toBe(false);
    expect(errorFields(result)).toContain("label");
  });
});
