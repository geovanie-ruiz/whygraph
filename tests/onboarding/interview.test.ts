import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runInterview } from "../../src/onboarding/interview.js";
import { writeEntity } from "../../src/entity/writer.js";
import { parseEntity } from "../../src/entity/parser.js";
import type { StructuralNode } from "../../src/entity/types.js";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-interview-test-"));
}

function setupWhygraphDir(tempDir: string): string {
  const whygraphDir = join(tempDir, ".whygraph");
  const graphDir = join(whygraphDir, "graph");
  mkdirSync(graphDir, { recursive: true });

  // Create an App node
  const appNode: StructuralNode = {
    id: "wg-app1",
    label: "App",
    name: "TestApp",
    status: "active",
    created_at: "2026-03-24T00:00:00Z",
    updated_at: "2026-03-24T00:00:00Z",
  };
  writeEntity(graphDir, appNode);

  return whygraphDir;
}

function readAllEntities(graphDir: string) {
  const files = readdirSync(graphDir).filter((f) => f.endsWith(".md"));
  return files.map((f) => {
    const content = readFileSync(join(graphDir, f), "utf-8");
    return parseEntity(content);
  }).filter((e) => e !== null);
}

describe("runInterview", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates Feature nodes from provided features", async () => {
    const whygraphDir = setupWhygraphDir(tempDir);

    const result = await runInterview(whygraphDir, {
      features: [
        { name: "Authentication" },
        { name: "Billing" },
      ],
    });

    expect(result.created).toHaveLength(2);
    expect(result.created[0].label).toBe("Feature");
    expect(result.created[0].name).toBe("Authentication");
    expect(result.created[1].label).toBe("Feature");
    expect(result.created[1].name).toBe("Billing");

    // Verify files on disk
    const graphDir = join(whygraphDir, "graph");
    const entities = readAllEntities(graphDir);
    const features = entities.filter((e) => e!.label === "Feature");
    expect(features).toHaveLength(2);
  });

  it("creates Component nodes with correct parent", async () => {
    const whygraphDir = setupWhygraphDir(tempDir);

    const result = await runInterview(whygraphDir, {
      features: [{ name: "Authentication" }],
      components: [
        { name: "Login Form", parent: "Authentication" },
        { name: "Session Manager", parent: "Authentication" },
      ],
    });

    expect(result.created).toHaveLength(3);

    const featureEntry = result.created.find((c) => c.label === "Feature");
    const componentEntries = result.created.filter((c) => c.label === "Component");

    expect(featureEntry).toBeDefined();
    expect(componentEntries).toHaveLength(2);

    // Verify parent relationship on disk
    const graphDir = join(whygraphDir, "graph");
    const entities = readAllEntities(graphDir);
    const components = entities.filter((e) => e!.label === "Component") as StructuralNode[];

    expect(components).toHaveLength(2);
    for (const component of components) {
      expect(component.parent).toBe(featureEntry!.id);
    }
  });

  it("populates refs from provided file paths", async () => {
    const whygraphDir = setupWhygraphDir(tempDir);

    await runInterview(whygraphDir, {
      features: [
        { name: "Authentication", files: ["src/auth/index.ts", "src/auth/session.ts"] },
      ],
    });

    const graphDir = join(whygraphDir, "graph");
    const entities = readAllEntities(graphDir);
    const feature = entities.find((e) => e!.label === "Feature") as StructuralNode;

    expect(feature.refs).toBeDefined();
    expect(feature.refs).toHaveLength(2);
    expect(feature.refs![0].file).toBe("src/auth/index.ts");
    expect(feature.refs![1].file).toBe("src/auth/session.ts");
  });

  it("returns summary of created entities", async () => {
    const whygraphDir = setupWhygraphDir(tempDir);

    const result = await runInterview(whygraphDir, {
      features: [{ name: "Auth" }],
      components: [{ name: "Login", parent: "Auth" }],
    });

    expect(result.created).toHaveLength(2);
    expect(result.created[0]).toHaveProperty("id");
    expect(result.created[0]).toHaveProperty("label");
    expect(result.created[0]).toHaveProperty("name");
    expect(typeof result.gaps).toBe("number");
  });

  it("skips components whose parent feature is not provided", async () => {
    const whygraphDir = setupWhygraphDir(tempDir);

    const result = await runInterview(whygraphDir, {
      features: [{ name: "Auth" }],
      components: [{ name: "Widget", parent: "NonExistent" }],
    });

    // Only the feature should be created, the component should be skipped
    expect(result.created).toHaveLength(1);
    expect(result.created[0].label).toBe("Feature");
  });
});
