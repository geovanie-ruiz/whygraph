import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import yaml from "js-yaml";
import { runConfig } from "../../src/cli/commands/config.js";
import type { WhygraphConfig } from "../../src/entity/types.js";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-config-test-"));
}

function writeTestConfig(tempDir: string, config: WhygraphConfig): void {
  const whygraphDir = join(tempDir, ".whygraph");
  mkdirSync(whygraphDir, { recursive: true });
  const configPath = join(whygraphDir, "config.yaml");
  writeFileSync(configPath, yaml.dump(config, { lineWidth: -1 }), "utf-8");
}

function defaultConfig(): WhygraphConfig {
  return {
    appName: "TestApp",
    environment: "claude-code",
    prefix: "wg-",
    idLength: 4,
    tags: ["arch", "data", "security", "performance", "integration", "infra", "ux"],
    mcpMode: "default",
    serverPort: 4777,
  };
}

describe("runConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("read existing config returns all fields", () => {
    const config = defaultConfig();
    writeTestConfig(tempDir, config);

    const result = runConfig(tempDir);

    expect(result.updated).toBe(false);
    expect(result.config.appName).toBe("TestApp");
    expect(result.config.environment).toBe("claude-code");
    expect(result.config.prefix).toBe("wg-");
    expect(result.config.idLength).toBe(4);
    expect(result.config.tags).toEqual([
      "arch", "data", "security", "performance", "integration", "infra", "ux",
    ]);
    expect(result.config.mcpMode).toBe("default");
    expect(result.config.serverPort).toBe(4777);
  });

  it("update single field preserves other fields", () => {
    writeTestConfig(tempDir, defaultConfig());

    const result = runConfig(tempDir, { environment: "cursor" });

    expect(result.updated).toBe(true);
    expect(result.config.environment).toBe("cursor");
    expect(result.config.appName).toBe("TestApp");
    expect(result.config.prefix).toBe("wg-");
    expect(result.config.serverPort).toBe(4777);

    // Verify it was persisted to disk
    const raw = readFileSync(
      join(tempDir, ".whygraph", "config.yaml"),
      "utf-8",
    );
    const persisted = yaml.load(raw) as WhygraphConfig;
    expect(persisted.environment).toBe("cursor");
    expect(persisted.appName).toBe("TestApp");
  });

  it("invalid value returns error", () => {
    writeTestConfig(tempDir, defaultConfig());

    expect(() => runConfig(tempDir, { environment: "vim" })).toThrow(
      /Invalid environment/,
    );

    expect(() => runConfig(tempDir, { mcpMode: "loose" })).toThrow(
      /Invalid mcpMode/,
    );
  });

  it("missing .whygraph/ returns error", () => {
    expect(() => runConfig(tempDir)).toThrow(/not found/);
  });
});
