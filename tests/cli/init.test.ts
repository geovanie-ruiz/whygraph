import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import yaml from "js-yaml";
import { runInit } from "../../src/cli/commands/init.js";
import type { WhygraphConfig } from "../../src/entity/types.js";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-init-test-"));
}

describe("runInit", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates .whygraph/ directory structure", async () => {
    await runInit(tempDir, {
      appName: "TestApp",
      environment: "claude-code",
    });

    expect(existsSync(join(tempDir, ".whygraph"))).toBe(true);
    expect(existsSync(join(tempDir, ".whygraph", "graph"))).toBe(true);
    expect(existsSync(join(tempDir, ".whygraph", "config.yaml"))).toBe(true);
  });

  it("creates config.yaml with correct defaults", async () => {
    await runInit(tempDir, {
      appName: "TestApp",
      environment: "claude-code",
    });

    const configPath = join(tempDir, ".whygraph", "config.yaml");
    const raw = readFileSync(configPath, "utf-8");
    const config = yaml.load(raw) as WhygraphConfig;

    expect(config.appName).toBe("TestApp");
    expect(config.environment).toBe("claude-code");
    expect(config.prefix).toBe("wg-");
    expect(config.idLength).toBe(4);
    expect(config.tags).toEqual([
      "arch",
      "data",
      "security",
      "performance",
      "integration",
      "infra",
      "ux",
    ]);
    expect(config.mpcMode).toBe("default");
    expect(config.serverPort).toBe(4777);
  });

  it("creates App node file in .whygraph/graph/", async () => {
    const result = await runInit(tempDir, {
      appName: "TestApp",
      environment: "claude-code",
    });

    expect(existsSync(result.appNodePath)).toBe(true);

    const content = readFileSync(result.appNodePath, "utf-8");
    expect(content).toContain("label: App");
    expect(content).toContain("name: TestApp");
    expect(content).toContain("status: active");
    expect(content).toContain(`id: ${result.appId}`);
  });

  it("aborts if .whygraph/ already exists", async () => {
    mkdirSync(join(tempDir, ".whygraph"), { recursive: true });

    await expect(
      runInit(tempDir, {
        appName: "TestApp",
        environment: "claude-code",
      }),
    ).rejects.toThrow(/already exists/);
  });

  it("App node has correct label and name from options", async () => {
    const result = await runInit(tempDir, {
      appName: "MyCustomApp",
      environment: "cursor",
    });

    const content = readFileSync(result.appNodePath, "utf-8");
    expect(content).toContain("label: App");
    expect(content).toContain("name: MyCustomApp");

    // Verify the ID follows the prefix pattern
    expect(result.appId).toMatch(/^wg-[0-9a-z]{4}$/);
  });

  it("returns structured result for --json consumption", async () => {
    const result = await runInit(tempDir, {
      appName: "JsonApp",
      environment: "other",
    });

    expect(result).toHaveProperty("configPath");
    expect(result).toHaveProperty("appNodePath");
    expect(result).toHaveProperty("appId");
    expect(typeof result.configPath).toBe("string");
    expect(typeof result.appNodePath).toBe("string");
    expect(typeof result.appId).toBe("string");
  });
});
