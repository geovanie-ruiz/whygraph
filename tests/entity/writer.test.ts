import { describe, it, expect } from "vitest";
import { renderEntity, writeEntity } from "../../src/entity/writer.js";
import { parseEntity } from "../../src/entity/parser.js";
import type { StructuralNode, DecisionNode } from "../../src/entity/types.js";
import { existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ============================================================
// Fixtures
// ============================================================

function makeStructuralNode(overrides?: Partial<StructuralNode>): StructuralNode {
  return {
    id: "wg-a1b2",
    label: "Feature",
    name: "Authentication",
    status: "active",
    created_at: "2026-03-24T00:00:00Z",
    updated_at: "2026-03-24T00:00:00Z",
    ...overrides,
  };
}

function makeDecisionNode(overrides?: Partial<DecisionNode>): DecisionNode {
  return {
    id: "wg-c3d4",
    label: "Decision",
    title: "Use WebSockets for live updates",
    status: "active",
    date: "2026-03-24",
    affects: ["wg-a1b2", "wg-e5f6"],
    tags: ["arch", "integration"],
    context: "The baked HTML viz requires manual refresh.",
    decision: "Use WebSocket subscriptions from the server.",
    tradeoffs: "Gained: real-time. Lost: requires running server.",
    alternatives: "Polling — rejected: latency.",
    created_at: "2026-03-24T10:00:00Z",
    updated_at: "2026-03-24T10:00:00Z",
    ...overrides,
  };
}

// ============================================================
// renderEntity — structural node
// ============================================================

describe("renderEntity", () => {
  it("produces valid markdown for a structural node", () => {
    const node = makeStructuralNode();
    const md = renderEntity(node);

    expect(md).toContain("---");
    expect(md).toContain("id: wg-a1b2");
    expect(md).toContain("label: Feature");
    expect(md).toContain("name: Authentication");
    expect(md).toContain("status: active");

    // Should be parseable
    const parsed = parseEntity(md);
    expect(parsed).not.toBeNull();
  });

  it("produces valid markdown for a decision with all body sections", () => {
    const node = makeDecisionNode();
    const md = renderEntity(node);

    expect(md).toContain("id: wg-c3d4");
    expect(md).toContain("label: Decision");
    expect(md).toContain("title: Use WebSockets for live updates");
    expect(md).toContain("## Context");
    expect(md).toContain("The baked HTML viz requires manual refresh.");
    expect(md).toContain("## Decision");
    expect(md).toContain("## Tradeoffs");
    expect(md).toContain("## Alternatives");
  });

  it("handles optional fields: refs, parent, supersedes, removed_at", () => {
    const structural = makeStructuralNode({
      parent: "wg-app1",
      refs: [
        { file: "src/auth/session.ts" },
        { file: "src/auth/session.ts", symbol: "createSession" },
      ],
      description: "Manages user sessions",
      removed_at: "2026-03-25T00:00:00Z",
    });
    const md = renderEntity(structural);

    expect(md).toContain("parent: wg-app1");
    expect(md).toContain("removed_at:");
    expect(md).toContain("src/auth/session.ts");
    expect(md).toContain("Manages user sessions");

    const decision = makeDecisionNode({
      supersedes: "wg-old1",
      removed_at: "2026-03-25T00:00:00Z",
    });
    const dmd = renderEntity(decision);
    expect(dmd).toContain("supersedes: wg-old1");
    expect(dmd).toContain("removed_at:");
  });
});

// ============================================================
// Roundtrip tests
// ============================================================

describe("roundtrip: parseEntity(renderEntity(entity))", () => {
  it("structural node roundtrips correctly", () => {
    const node = makeStructuralNode({
      parent: "wg-app1",
      description: "Handles user authentication flows.",
    });
    const rendered = renderEntity(node);
    const parsed = parseEntity(rendered);

    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(node);
  });

  it("structural node with refs roundtrips correctly", () => {
    const node = makeStructuralNode({
      parent: "wg-app1",
      refs: [
        { file: "src/auth/session.ts" },
        { file: "src/auth/session.ts", symbol: "createSession" },
      ],
      description: "Manages user sessions",
      removed_at: "2026-03-25T00:00:00Z",
    });
    const rendered = renderEntity(node);
    const parsed = parseEntity(rendered);

    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(node);
  });

  it("decision node roundtrips correctly", () => {
    const node = makeDecisionNode();
    const rendered = renderEntity(node);
    const parsed = parseEntity(rendered);

    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(node);
  });

  it("decision node with supersedes roundtrips correctly", () => {
    const node = makeDecisionNode({
      supersedes: "wg-old1",
      removed_at: "2026-03-25T00:00:00Z",
    });
    const rendered = renderEntity(node);
    const parsed = parseEntity(rendered);

    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(node);
  });

  it("structural node without optional fields roundtrips correctly", () => {
    const node = makeStructuralNode();
    const rendered = renderEntity(node);
    const parsed = parseEntity(rendered);

    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(node);
  });
});

// ============================================================
// writeEntity — disk operations
// ============================================================

describe("writeEntity", () => {
  function makeTmpDir(): string {
    const dir = join(tmpdir(), `whygraph-writer-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  function cleanup(dir: string): void {
    rmSync(dir, { recursive: true, force: true });
  }

  it("creates the file on disk in the correct directory", () => {
    const dir = makeTmpDir();
    try {
      const node = makeStructuralNode();
      const filePath = writeEntity(dir, node);

      expect(existsSync(filePath)).toBe(true);
      expect(filePath).toContain(dir);
      expect(filePath).toMatch(/wg-a1b2--authentication\.md$/);

      const content = readFileSync(filePath, "utf-8");
      const parsed = parseEntity(content);
      expect(parsed).toEqual(node);
    } finally {
      cleanup(dir);
    }
  });

  it("creates parent directories if missing", () => {
    const dir = join(makeTmpDir(), "nested", "deep");
    const parent = join(dir, "..", "..");
    try {
      expect(existsSync(dir)).toBe(false);
      const node = makeDecisionNode();
      const filePath = writeEntity(dir, node);

      expect(existsSync(filePath)).toBe(true);
      expect(filePath).toContain(dir);
    } finally {
      cleanup(parent);
    }
  });

  it("uses toFilename for decision nodes with title", () => {
    const dir = makeTmpDir();
    try {
      const node = makeDecisionNode();
      const filePath = writeEntity(dir, node);
      expect(filePath).toMatch(/wg-c3d4--use-websockets-for-live-updates\.md$/);
    } finally {
      cleanup(dir);
    }
  });
});
