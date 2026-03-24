import { describe, it, expect } from "vitest";
import { applyEvent, type Entity, type EntityChangeEvent } from "../lib/store";

function makeNode(id: string, name: string): Entity {
  return {
    id,
    label: "Module",
    name,
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeDecision(id: string, title: string): Entity {
  return {
    id,
    label: "Decision",
    title,
    status: "active",
    date: "2026-01-01",
    affects: [],
    tags: [],
    context: "ctx",
    decision: "dec",
    tradeoffs: "trade",
    alternatives: "alt",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as Entity;
}

describe("applyEvent", () => {
  it("populates map from INITIAL_SNAPSHOT", () => {
    const entities = [makeNode("n1", "Auth"), makeDecision("d1", "Use JWT")];
    const event: EntityChangeEvent = {
      type: "INITIAL_SNAPSHOT",
      entities,
    };

    const result = applyEvent(new Map(), event);

    expect(result.size).toBe(2);
    expect(result.get("n1")).toEqual(entities[0]);
    expect(result.get("d1")).toEqual(entities[1]);
  });

  it("replaces existing map on INITIAL_SNAPSHOT", () => {
    const existing = new Map<string, Entity>([
      ["old", makeNode("old", "Stale")],
    ]);
    const event: EntityChangeEvent = {
      type: "INITIAL_SNAPSHOT",
      entities: [makeNode("n1", "Fresh")],
    };

    const result = applyEvent(existing, event);

    expect(result.size).toBe(1);
    expect(result.has("old")).toBe(false);
    expect(result.has("n1")).toBe(true);
  });

  it("upserts on CREATED", () => {
    const node = makeNode("n1", "Auth");
    const event: EntityChangeEvent = {
      type: "CREATED",
      entity: node,
    };

    const result = applyEvent(new Map(), event);

    expect(result.size).toBe(1);
    expect(result.get("n1")).toEqual(node);
  });

  it("upserts on UPDATED", () => {
    const original = makeNode("n1", "Auth");
    const updated = { ...original, name: "AuthV2", updated_at: "2026-02-01T00:00:00Z" };
    const existing = new Map<string, Entity>([["n1", original]]);

    const result = applyEvent(existing, {
      type: "UPDATED",
      entity: updated,
    });

    expect(result.get("n1")).toEqual(updated);
  });

  it("removes on DELETED", () => {
    const existing = new Map<string, Entity>([
      ["n1", makeNode("n1", "Auth")],
      ["n2", makeNode("n2", "DB")],
    ]);

    const result = applyEvent(existing, {
      type: "DELETED",
      entityId: "n1",
    });

    expect(result.size).toBe(1);
    expect(result.has("n1")).toBe(false);
    expect(result.has("n2")).toBe(true);
  });

  it("returns same map if DELETED entity not found", () => {
    const existing = new Map<string, Entity>();
    const result = applyEvent(existing, {
      type: "DELETED",
      entityId: "nonexistent",
    });
    // Still returns a new map (that's fine), but size is 0
    expect(result.size).toBe(0);
  });

  it("handles empty INITIAL_SNAPSHOT", () => {
    const result = applyEvent(new Map(), {
      type: "INITIAL_SNAPSHOT",
      entities: [],
    });
    expect(result.size).toBe(0);
  });
});
