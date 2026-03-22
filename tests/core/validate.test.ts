import { describe, it, expect } from "vitest";
import { validateEvent, type ValidationContext } from "../../src/core/validate.js";
import type {
  NodeAddedEvent,
  EdgeAddedEvent,
  NodePatchedEvent,
  EdgeRemovedEvent,
  NodeRemovedEvent,
  WhyEvent,
  NodeLabel,
} from "../../src/core/types.js";

// ── Helpers ──────────────────────────────────────────────────────────

const uuid = () => "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const edgeId = () => `edge-${uuid()}`;
const ts = () => "2026-03-22T10:00:00Z";

function validDecisionNodeAdded(overrides: Partial<NodeAddedEvent> = {}): NodeAddedEvent {
  return {
    type: "node_added",
    timestamp: ts(),
    id: uuid(),
    label: "Decision",
    properties: {
      title: "Use event sourcing",
      date: "2026-03-22",
      context: "Need immutable history",
      decision: "Append-only JSONL",
      tradeoffs: "Simple but grows",
      alternatives: "SQLite rejected",
      status: "active",
      affects: [uuid()],
    },
    ...overrides,
  };
}

function validFeatureNodeAdded(overrides: Partial<NodeAddedEvent> = {}): NodeAddedEvent {
  return {
    type: "node_added",
    timestamp: ts(),
    id: uuid(),
    label: "Feature",
    properties: { name: "Core Graph" },
    ...overrides,
  };
}

function validEdgeAdded(overrides: Partial<EdgeAddedEvent> = {}): EdgeAddedEvent {
  return {
    type: "edge_added",
    timestamp: ts(),
    id: edgeId(),
    label: "COMPOSES",
    from: uuid(),
    to: uuid(),
    ...overrides,
  };
}

function contextWith(entries: [string, NodeLabel][]): ValidationContext {
  return { nodeLabels: new Map(entries) };
}

// ── UUID validation ──────────────────────────────────────────────────

describe("UUID validation", () => {
  it("rejects node ID that is not a valid UUID", () => {
    const event = validFeatureNodeAdded({ id: "not-a-uuid" });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("uuid"))).toBe(true);
  });

  it("rejects node ID with uppercase hex", () => {
    const event = validFeatureNodeAdded({ id: "A1B2C3D4-E5F6-7890-ABCD-EF1234567890" });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
  });

  it("rejects node ID with wrong structure", () => {
    const event = validFeatureNodeAdded({ id: "12345678-1234-1234-1234" });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
  });

  it("accepts valid UUID node ID", () => {
    const event = validFeatureNodeAdded({ id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" });
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });
});

// ── Edge ID validation ───────────────────────────────────────────────

describe("Edge ID validation", () => {
  it("rejects edge ID without edge- prefix", () => {
    const event = validEdgeAdded({ id: uuid() });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("edge-"))).toBe(true);
  });

  it("rejects edge ID with invalid UUID after prefix", () => {
    const event = validEdgeAdded({ id: "edge-not-a-uuid" });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
  });

  it("accepts valid edge ID", () => {
    const event = validEdgeAdded({ id: edgeId() });
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });
});

// ── Timestamp validation ─────────────────────────────────────────────

describe("Timestamp validation", () => {
  it("rejects non-ISO 8601 timestamp", () => {
    const event = validFeatureNodeAdded({ timestamp: "March 22, 2026" });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("timestamp"))).toBe(true);
  });

  it("rejects date-only as timestamp (not ISO 8601 datetime)", () => {
    const event = validFeatureNodeAdded({ timestamp: "2026-03-22" });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
  });

  it("rejects empty timestamp", () => {
    const event = validFeatureNodeAdded({ timestamp: "" });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
  });

  it("accepts ISO 8601 timestamp with Z", () => {
    const event = validFeatureNodeAdded({ timestamp: "2026-03-22T10:00:00Z" });
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });

  it("accepts ISO 8601 timestamp with offset", () => {
    const event = validFeatureNodeAdded({ timestamp: "2026-03-22T10:00:00+05:30" });
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });

  it("accepts ISO 8601 timestamp with milliseconds", () => {
    const event = validFeatureNodeAdded({ timestamp: "2026-03-22T10:00:00.123Z" });
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });
});

// ── Decision date validation ─────────────────────────────────────────

describe("Decision date validation", () => {
  it("rejects decision with invalid date format", () => {
    const event = validDecisionNodeAdded({
      properties: {
        ...validDecisionNodeAdded().properties as any,
        date: "03/22/2026",
      },
    });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("date"))).toBe(true);
  });

  it("accepts decision with valid YYYY-MM-DD date", () => {
    const event = validDecisionNodeAdded();
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });
});

// ── Decision required properties ─────────────────────────────────────

describe("Decision node_added required properties", () => {
  const requiredFields = [
    "title",
    "date",
    "context",
    "decision",
    "tradeoffs",
    "alternatives",
    "status",
    "affects",
  ];

  for (const field of requiredFields) {
    it(`rejects decision missing ${field}`, () => {
      const props = { ...(validDecisionNodeAdded().properties as any) };
      delete props[field];
      const event = validDecisionNodeAdded({ properties: props });
      const result = validateEvent(event);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(field))).toBe(true);
    });
  }

  it("rejects decision with empty title", () => {
    const props = { ...(validDecisionNodeAdded().properties as any), title: "" };
    const event = validDecisionNodeAdded({ properties: props });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
  });

  it("rejects decision with empty context", () => {
    const props = { ...(validDecisionNodeAdded().properties as any), context: "" };
    const event = validDecisionNodeAdded({ properties: props });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
  });

  it("rejects decision with empty affects array", () => {
    const props = { ...(validDecisionNodeAdded().properties as any), affects: [] };
    const event = validDecisionNodeAdded({ properties: props });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
  });
});

// ── Edge hierarchy validation ────────────────────────────────────────

describe("Edge hierarchy: COMPOSES", () => {
  const fromId = "11111111-1111-1111-1111-111111111111";
  const toId = "22222222-2222-2222-2222-222222222222";

  it("rejects COMPOSES from Decision", () => {
    const ctx = contextWith([
      [fromId, "Decision"],
      [toId, "Feature"],
    ]);
    const event = validEdgeAdded({
      from: fromId,
      to: toId,
      label: "COMPOSES",
    });
    const result = validateEvent(event, ctx);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("COMPOSES"))).toBe(true);
  });

  it("accepts COMPOSES from App to Feature", () => {
    const ctx = contextWith([
      [fromId, "App"],
      [toId, "Feature"],
    ]);
    const event = validEdgeAdded({
      from: fromId,
      to: toId,
      label: "COMPOSES",
    });
    const result = validateEvent(event, ctx);
    expect(result.valid).toBe(true);
  });

  it("accepts COMPOSES from Feature to Component", () => {
    const ctx = contextWith([
      [fromId, "Feature"],
      [toId, "Component"],
    ]);
    const event = validEdgeAdded({
      from: fromId,
      to: toId,
      label: "COMPOSES",
    });
    const result = validateEvent(event, ctx);
    expect(result.valid).toBe(true);
  });

  it("rejects COMPOSES from App to Decision", () => {
    const ctx = contextWith([
      [fromId, "App"],
      [toId, "Decision"],
    ]);
    const event = validEdgeAdded({
      from: fromId,
      to: toId,
      label: "COMPOSES",
    });
    const result = validateEvent(event, ctx);
    expect(result.valid).toBe(false);
  });
});

describe("Edge hierarchy: AFFECTS", () => {
  const fromId = "11111111-1111-1111-1111-111111111111";
  const toId = "22222222-2222-2222-2222-222222222222";

  it("rejects AFFECTS from Feature", () => {
    const ctx = contextWith([
      [fromId, "Feature"],
      [toId, "Component"],
    ]);
    const event = validEdgeAdded({
      from: fromId,
      to: toId,
      label: "AFFECTS",
    });
    const result = validateEvent(event, ctx);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("AFFECTS"))).toBe(true);
  });

  it("accepts AFFECTS from Decision", () => {
    const ctx = contextWith([
      [fromId, "Decision"],
      [toId, "Feature"],
    ]);
    const event = validEdgeAdded({
      from: fromId,
      to: toId,
      label: "AFFECTS",
    });
    const result = validateEvent(event, ctx);
    expect(result.valid).toBe(true);
  });
});

describe("Edge hierarchy: SUPERSEDES", () => {
  const fromId = "11111111-1111-1111-1111-111111111111";
  const toId = "22222222-2222-2222-2222-222222222222";

  it("rejects SUPERSEDES from Feature", () => {
    const ctx = contextWith([
      [fromId, "Feature"],
      [toId, "Decision"],
    ]);
    const event = validEdgeAdded({
      from: fromId,
      to: toId,
      label: "SUPERSEDES",
    });
    const result = validateEvent(event, ctx);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("SUPERSEDES"))).toBe(true);
  });

  it("rejects SUPERSEDES to Feature", () => {
    const ctx = contextWith([
      [fromId, "Decision"],
      [toId, "Feature"],
    ]);
    const event = validEdgeAdded({
      from: fromId,
      to: toId,
      label: "SUPERSEDES",
    });
    const result = validateEvent(event, ctx);
    expect(result.valid).toBe(false);
  });

  it("accepts SUPERSEDES from Decision to Decision", () => {
    const ctx = contextWith([
      [fromId, "Decision"],
      [toId, "Decision"],
    ]);
    const event = validEdgeAdded({
      from: fromId,
      to: toId,
      label: "SUPERSEDES",
    });
    const result = validateEvent(event, ctx);
    expect(result.valid).toBe(true);
  });
});

describe("Edge hierarchy: DEPRECATES", () => {
  const fromId = "11111111-1111-1111-1111-111111111111";
  const toId = "22222222-2222-2222-2222-222222222222";

  it("rejects DEPRECATES between different node types (Feature to Component)", () => {
    const ctx = contextWith([
      [fromId, "Feature"],
      [toId, "Component"],
    ]);
    const event = validEdgeAdded({
      from: fromId,
      to: toId,
      label: "DEPRECATES",
    });
    const result = validateEvent(event, ctx);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("DEPRECATES"))).toBe(true);
  });

  it("accepts DEPRECATES between same node types (Feature to Feature)", () => {
    const ctx = contextWith([
      [fromId, "Feature"],
      [toId, "Feature"],
    ]);
    const event = validEdgeAdded({
      from: fromId,
      to: toId,
      label: "DEPRECATES",
    });
    const result = validateEvent(event, ctx);
    expect(result.valid).toBe(true);
  });

  it("accepts DEPRECATES between same node types (Component to Component)", () => {
    const ctx = contextWith([
      [fromId, "Component"],
      [toId, "Component"],
    ]);
    const event = validEdgeAdded({
      from: fromId,
      to: toId,
      label: "DEPRECATES",
    });
    const result = validateEvent(event, ctx);
    expect(result.valid).toBe(true);
  });
});

describe("Edge validation without context", () => {
  it("skips hierarchy check when no context provided", () => {
    const event = validEdgeAdded({
      from: "11111111-1111-1111-1111-111111111111",
      to: "22222222-2222-2222-2222-222222222222",
      label: "AFFECTS",
    });
    // Without context, we can't check hierarchy — should pass
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });

  it("still validates edge ID format without context", () => {
    const event = validEdgeAdded({ id: "bad-id" });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
  });
});

// ── node_patched validation ──────────────────────────────────────────

describe("node_patched validation", () => {
  it("rejects patch attempting to modify affects", () => {
    const event: NodePatchedEvent = {
      type: "node_patched",
      timestamp: ts(),
      id: uuid(),
      properties: { affects: [uuid()] },
    };
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("affects"))).toBe(true);
  });

  it("rejects patch attempting to modify label", () => {
    const event: NodePatchedEvent = {
      type: "node_patched",
      timestamp: ts(),
      id: uuid(),
      properties: { label: "Feature" } as any,
    };
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("label"))).toBe(true);
  });

  it("rejects patch with unknown property", () => {
    const event: NodePatchedEvent = {
      type: "node_patched",
      timestamp: ts(),
      id: uuid(),
      properties: { unknownProp: "value" } as any,
    };
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("unknownProp"))).toBe(true);
  });

  it("accepts valid patch of status", () => {
    const event: NodePatchedEvent = {
      type: "node_patched",
      timestamp: ts(),
      id: uuid(),
      properties: { status: "superseded" },
    };
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });

  it("accepts valid patch of title", () => {
    const event: NodePatchedEvent = {
      type: "node_patched",
      timestamp: ts(),
      id: uuid(),
      properties: { title: "Updated title" },
    };
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });
});

// ── Valid events of all five types ───────────────────────────────────

describe("Accepts valid events of all five types", () => {
  it("accepts valid node_added (Feature)", () => {
    const result = validateEvent(validFeatureNodeAdded());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts valid node_added (Decision)", () => {
    const result = validateEvent(validDecisionNodeAdded());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts valid node_added (App)", () => {
    const event: NodeAddedEvent = {
      type: "node_added",
      timestamp: ts(),
      id: uuid(),
      label: "App",
      properties: { name: "Whygraph" },
    };
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });

  it("accepts valid node_added (Component)", () => {
    const event: NodeAddedEvent = {
      type: "node_added",
      timestamp: ts(),
      id: uuid(),
      label: "Component",
      properties: { name: "EventStore" },
    };
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });

  it("accepts valid edge_added", () => {
    const result = validateEvent(validEdgeAdded());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts valid node_patched", () => {
    const event: NodePatchedEvent = {
      type: "node_patched",
      timestamp: ts(),
      id: uuid(),
      properties: { status: "superseded" },
    };
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });

  it("accepts valid edge_removed", () => {
    const event: EdgeRemovedEvent = {
      type: "edge_removed",
      timestamp: ts(),
      id: edgeId(),
    };
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });

  it("accepts valid node_removed", () => {
    const event: NodeRemovedEvent = {
      type: "node_removed",
      timestamp: ts(),
      id: uuid(),
    };
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });
});

// ── Collects all errors ──────────────────────────────────────────────

describe("Error collection", () => {
  it("collects multiple errors rather than returning early", () => {
    const event = validDecisionNodeAdded({
      id: "bad id",
      timestamp: "not-a-date",
    });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ── edge_added from/to UUID validation ───────────────────────────────

describe("edge_added from/to validation", () => {
  it("rejects edge with invalid from UUID", () => {
    const event = validEdgeAdded({ from: "not-a-uuid" });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
  });

  it("rejects edge with invalid to UUID", () => {
    const event = validEdgeAdded({ to: "not-a-uuid" });
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
  });
});
