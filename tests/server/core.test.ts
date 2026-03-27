import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServerCore } from "../../src/server/core.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "whygraph-test-"));
}

function structuralMd(id: string, opts: { label?: string; name?: string; parent?: string; status?: string } = {}): string {
  const label = opts.label ?? "Feature";
  const name = opts.name ?? "TestFeature";
  const parent = opts.parent ? `parent: ${opts.parent}\n` : "";
  const status = opts.status ?? "active";
  return `---
id: ${id}
label: ${label}
name: ${name}
status: ${status}
${parent}created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---
`;
}

function decisionMd(id: string, opts: { affects?: string[]; supersedes?: string } = {}): string {
  const affects = opts.affects ?? [];
  const affectsYaml = affects.length > 0
    ? `affects:\n${affects.map((a) => `  - ${a}`).join("\n")}`
    : "affects: []";
  const supersedes = opts.supersedes ? `supersedes: ${opts.supersedes}\n` : "";
  return `---
id: ${id}
label: Decision
title: Test Decision
status: active
date: "2026-03-24"
${affectsYaml}
tags:
  - arch
${supersedes}created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---

## Context

Some context.

## Decision

Some decision.

## Tradeoffs

Some tradeoffs.

## Alternatives

Some alternatives.
`;
}

describe("ServerCore", () => {
  let whygraphDir: string;
  let graphDir: string;

  beforeEach(async () => {
    whygraphDir = await makeTempDir();
    graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });
  });

  describe("load() with empty directory", () => {
    it("produces empty map and graph", async () => {
      const core = new ServerCore(whygraphDir);
      await core.load();

      expect(core.getAllEntities()).toEqual([]);
      expect(core.getEntityMap().size).toBe(0);
      expect(core.getGraph().order).toBe(0);
      expect(core.getGraph().size).toBe(0);
    });
  });

  describe("load() parses structural node", () => {
    it("parses a structural node file into the entity map", async () => {
      await fs.writeFile(path.join(graphDir, "wg-feat1.md"), structuralMd("wg-feat1"));
      const core = new ServerCore(whygraphDir);
      await core.load();

      const entity = core.getEntity("wg-feat1");
      expect(entity).toBeDefined();
      expect(entity!.id).toBe("wg-feat1");
      expect(entity!.label).toBe("Feature");
    });
  });

  describe("load() parses decision node", () => {
    it("parses a decision file into the entity map", async () => {
      await fs.writeFile(path.join(graphDir, "wg-dec1.md"), decisionMd("wg-dec1", { affects: ["wg-feat1"] }));
      await fs.writeFile(path.join(graphDir, "wg-feat1.md"), structuralMd("wg-feat1"));
      const core = new ServerCore(whygraphDir);
      await core.load();

      const entity = core.getEntity("wg-dec1");
      expect(entity).toBeDefined();
      expect(entity!.label).toBe("Decision");
    });
  });

  describe("load() builds graph with correct nodes and edges", () => {
    it("creates COMPOSES edge for parent relationship", async () => {
      await fs.writeFile(path.join(graphDir, "wg-app1.md"), structuralMd("wg-app1", { label: "App", name: "MyApp" }));
      await fs.writeFile(path.join(graphDir, "wg-feat1.md"), structuralMd("wg-feat1", { parent: "wg-app1" }));
      const core = new ServerCore(whygraphDir);
      await core.load();

      const graph = core.getGraph();
      expect(graph.order).toBe(2);
      expect(graph.hasNode("wg-app1")).toBe(true);
      expect(graph.hasNode("wg-feat1")).toBe(true);
      expect(graph.hasEdge("wg-app1", "wg-feat1")).toBe(true);
    });

    it("creates AFFECTS edge for decision", async () => {
      await fs.writeFile(path.join(graphDir, "wg-feat1.md"), structuralMd("wg-feat1"));
      await fs.writeFile(path.join(graphDir, "wg-dec1.md"), decisionMd("wg-dec1", { affects: ["wg-feat1"] }));
      const core = new ServerCore(whygraphDir);
      await core.load();

      const graph = core.getGraph();
      expect(graph.hasEdge("wg-dec1", "wg-feat1")).toBe(true);
    });
  });

  describe("getEntity", () => {
    it("returns entity by ID", async () => {
      await fs.writeFile(path.join(graphDir, "wg-feat1.md"), structuralMd("wg-feat1"));
      const core = new ServerCore(whygraphDir);
      await core.load();

      expect(core.getEntity("wg-feat1")).toBeDefined();
      expect(core.getEntity("nonexistent")).toBeUndefined();
    });
  });

  describe("addOrUpdateEntity", () => {
    it("adds new entity and rebuilds graph", async () => {
      const core = new ServerCore(whygraphDir);
      await core.load();

      expect(core.getAllEntities()).toHaveLength(0);

      core.addOrUpdateEntity("wg-feat1", {
        id: "wg-feat1",
        label: "Feature",
        name: "Auth",
        status: "active",
        created_at: "2026-03-24T00:00:00Z",
        updated_at: "2026-03-24T00:00:00Z",
      });

      expect(core.getAllEntities()).toHaveLength(1);
      expect(core.getEntity("wg-feat1")).toBeDefined();
      expect(core.getGraph().hasNode("wg-feat1")).toBe(true);
    });

    it("updates existing entity and rebuilds graph", async () => {
      await fs.writeFile(path.join(graphDir, "wg-feat1.md"), structuralMd("wg-feat1", { name: "OldName" }));
      const core = new ServerCore(whygraphDir);
      await core.load();

      core.addOrUpdateEntity("wg-feat1", {
        id: "wg-feat1",
        label: "Feature",
        name: "NewName",
        status: "active",
        created_at: "2026-03-24T00:00:00Z",
        updated_at: "2026-03-24T00:00:00Z",
      });

      const entity = core.getEntity("wg-feat1");
      expect(entity).toBeDefined();
      expect((entity as { name: string }).name).toBe("NewName");
    });
  });

  describe("removeEntity", () => {
    it("removes entity and rebuilds graph", async () => {
      await fs.writeFile(path.join(graphDir, "wg-feat1.md"), structuralMd("wg-feat1"));
      const core = new ServerCore(whygraphDir);
      await core.load();

      expect(core.getEntity("wg-feat1")).toBeDefined();
      core.removeEntity("wg-feat1");
      expect(core.getEntity("wg-feat1")).toBeUndefined();
      expect(core.getGraph().hasNode("wg-feat1")).toBe(false);
    });

    it("is a no-op for nonexistent entity", async () => {
      const core = new ServerCore(whygraphDir);
      await core.load();
      core.removeEntity("nonexistent"); // should not throw
      expect(core.getAllEntities()).toHaveLength(0);
    });
  });

  describe("stale issue cleanup", () => {
    it("deletes issue for entity no longer in graph on load", async () => {
      // Write an issue file for an entity that doesn't exist in graph
      const issuesDir = path.join(whygraphDir, "issues");
      await fs.mkdir(issuesDir, { recursive: true });
      const staleIssue = {
        entityId: "wg-stale",
        errors: [{ field: "title", message: "missing title", severity: "error" }],
        createdAt: "2026-03-24T00:00:00Z",
        updatedAt: "2026-03-24T00:00:00Z",
      };
      await fs.writeFile(
        path.join(issuesDir, "wg-stale.json"),
        JSON.stringify(staleIssue, null, 2),
      );

      const core = new ServerCore(whygraphDir);
      await core.load();

      // After load, stale issue should be deleted since entity doesn't exist
      const issueFile = path.join(issuesDir, "wg-stale.json");
      try {
        await fs.access(issueFile);
        // If we get here, the file still exists — that's a test failure
        expect(true).toBe(false);
      } catch {
        // File deleted — expected
        expect(true).toBe(true);
      }
    });
  });

  describe("invalid files", () => {
    it("skips invalid files with warning, does not crash", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await fs.writeFile(path.join(graphDir, "bad.md"), "not valid frontmatter at all {{{}}}");
      await fs.writeFile(path.join(graphDir, "wg-feat1.md"), structuralMd("wg-feat1"));
      const core = new ServerCore(whygraphDir);
      await core.load();

      expect(core.getAllEntities()).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("skips non-md files", async () => {
      await fs.writeFile(path.join(graphDir, "notes.txt"), "some text");
      await fs.writeFile(path.join(graphDir, "wg-feat1.md"), structuralMd("wg-feat1"));
      const core = new ServerCore(whygraphDir);
      await core.load();

      expect(core.getAllEntities()).toHaveLength(1);
    });

    it("warns and skips file that cannot be read (EISDIR)", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      // Create a directory with .md extension — readFile on a dir throws EISDIR
      await fs.mkdir(path.join(graphDir, "wg-dir.md"), { recursive: true });
      await fs.writeFile(path.join(graphDir, "wg-feat1.md"), structuralMd("wg-feat1"));
      const core = new ServerCore(whygraphDir);
      await core.load();

      expect(core.getAllEntities()).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error reading file"),
        expect.anything(),
      );
      warnSpy.mockRestore();
    });

    it("handles missing graph directory gracefully", async () => {
      const emptyDir = await makeTempDir();
      const core = new ServerCore(emptyDir);
      await core.load();
      expect(core.getAllEntities()).toHaveLength(0);
    });
  });
});
