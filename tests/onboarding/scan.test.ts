import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runScan } from "../../src/onboarding/scan.js";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-scan-test-"));
}

function setupProject(tempDir: string, structure: Record<string, string[]>): void {
  for (const [dir, files] of Object.entries(structure)) {
    const fullDir = join(tempDir, dir);
    mkdirSync(fullDir, { recursive: true });
    for (const file of files) {
      writeFileSync(join(fullDir, file), `// ${file}\n`, "utf-8");
    }
  }
}

describe("runScan", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("scans a directory with subdirectories and proposes features", async () => {
    setupProject(tempDir, {
      "src/auth": ["index.ts", "session.ts"],
      "src/billing": ["index.ts"],
      "src/graph": ["index.ts"],
    });

    const whygraphDir = join(tempDir, ".whygraph");
    mkdirSync(whygraphDir, { recursive: true });

    const result = await runScan(tempDir, whygraphDir);

    expect(result.proposal.features).toHaveLength(3);

    const featureNames = result.proposal.features.map((f) => f.name).sort();
    expect(featureNames).toEqual(["auth", "billing", "graph"]);
  });

  it("proposes components from nested directories", async () => {
    setupProject(tempDir, {
      "src/auth": ["index.ts"],
      "src/auth/oauth": ["index.ts"],
      "src/auth/session": ["index.ts"],
    });

    const whygraphDir = join(tempDir, ".whygraph");
    mkdirSync(whygraphDir, { recursive: true });

    const result = await runScan(tempDir, whygraphDir);

    expect(result.proposal.features).toHaveLength(1);
    expect(result.proposal.features[0].name).toBe("auth");

    expect(result.proposal.components).toHaveLength(2);
    const componentNames = result.proposal.components.map((c) => c.name).sort();
    expect(componentNames).toEqual(["oauth", "session"]);

    for (const component of result.proposal.components) {
      expect(component.parentFeature).toBe("auth");
    }
  });

  it("identifies main files as refs", async () => {
    setupProject(tempDir, {
      "src/auth": ["index.ts", "helpers.ts", "types.ts"],
      "src/billing": ["mod.ts", "utils.ts"],
    });

    const whygraphDir = join(tempDir, ".whygraph");
    mkdirSync(whygraphDir, { recursive: true });

    const result = await runScan(tempDir, whygraphDir);

    const auth = result.proposal.features.find((f) => f.name === "auth");
    expect(auth).toBeDefined();
    expect(auth!.refs).toHaveLength(1);
    expect(auth!.refs[0].file).toBe("src/auth/index.ts");

    const billing = result.proposal.features.find((f) => f.name === "billing");
    expect(billing).toBeDefined();
    expect(billing!.refs).toHaveLength(1);
    expect(billing!.refs[0].file).toBe("src/billing/mod.ts");
  });

  it("empty directory returns empty proposal", async () => {
    // No src/ directory at all
    const whygraphDir = join(tempDir, ".whygraph");
    mkdirSync(whygraphDir, { recursive: true });

    const result = await runScan(tempDir, whygraphDir);

    expect(result.proposal.features).toHaveLength(0);
    expect(result.proposal.components).toHaveLength(0);
  });

  it("ignores hidden directories and node_modules", async () => {
    setupProject(tempDir, {
      "src/auth": ["index.ts"],
      "src/.hidden": ["index.ts"],
      "src/node_modules/pkg": ["index.ts"],
    });

    const whygraphDir = join(tempDir, ".whygraph");
    mkdirSync(whygraphDir, { recursive: true });

    const result = await runScan(tempDir, whygraphDir);

    expect(result.proposal.features).toHaveLength(1);
    expect(result.proposal.features[0].name).toBe("auth");
  });
});
