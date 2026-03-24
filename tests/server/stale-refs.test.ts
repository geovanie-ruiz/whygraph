import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { detectStaleRefs } from "../../src/server/stale-refs.js";
import type { Entity, StructuralNode, DecisionNode } from "../../src/entity/types.js";

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

describe("detectStaleRefs", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "whygraph-stale-refs-"));
    await fs.writeFile(path.join(tempDir, "existing.ts"), "// exists");
  });

  it("does not flag existing file", () => {
    const feat = makeStructural({
      id: "wg-feat1",
      refs: [{ file: "existing.ts" }],
    });

    const result = detectStaleRefs(toMap([feat]), tempDir);
    expect(result).toEqual([]);
  });

  it("flags missing file as stale ref", () => {
    const feat = makeStructural({
      id: "wg-feat1",
      name: "MyFeature",
      refs: [{ file: "missing.ts", symbol: "doStuff" }],
    });

    const result = detectStaleRefs(toMap([feat]), tempDir);

    expect(result).toHaveLength(1);
    expect(result[0].entityId).toBe("wg-feat1");
    expect(result[0].entityName).toBe("MyFeature");
    expect(result[0].ref.file).toBe("missing.ts");
    expect(result[0].ref.symbol).toBe("doStuff");
  });

  it("skips entities without refs", () => {
    const feat = makeStructural({ id: "wg-feat1" });
    const dec = makeDecision({ id: "wg-dec1", affects: ["wg-feat1"] });

    const result = detectStaleRefs(toMap([feat, dec]), tempDir);
    expect(result).toEqual([]);
  });

  it("returns entity context in stale refs", () => {
    const feat = makeStructural({
      id: "wg-comp1",
      label: "Component",
      name: "AuthModule",
      refs: [
        { file: "existing.ts" },
        { file: "gone.ts" },
      ],
    });

    const result = detectStaleRefs(toMap([feat]), tempDir);

    expect(result).toHaveLength(1);
    expect(result[0].entityId).toBe("wg-comp1");
    expect(result[0].entityName).toBe("AuthModule");
    expect(result[0].ref.file).toBe("gone.ts");
  });
});
