import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import yaml from "js-yaml";
import { runPrime } from "../../src/cli/commands/prime.js";
import type { WhygraphConfig } from "../../src/entity/types.js";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-prime-test-"));
}

function writeTestConfig(tempDir: string, config: WhygraphConfig): void {
  const whygraphDir = join(tempDir, ".whygraph");
  mkdirSync(whygraphDir, { recursive: true });
  const configPath = join(whygraphDir, "config.yaml");
  writeFileSync(configPath, yaml.dump(config, { lineWidth: -1 }), "utf-8");
}

function defaultConfig(overrides?: Partial<WhygraphConfig>): WhygraphConfig {
  return {
    appName: "TestApp",
    environment: "claude-code",
    prefix: "wg-",
    idLength: 4,
    tags: ["arch", "data", "security", "performance", "integration", "infra", "ux"],
    mcpMode: "default",
    serverPort: 4777,
    ...overrides,
  };
}

describe("runPrime", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("output includes decision capture directive", () => {
    writeTestConfig(tempDir, defaultConfig());

    const output = runPrime(tempDir);

    expect(output).toContain("Decision Capture Directive");
    expect(output).toContain("MUST capture");
  });

  it("output includes server verification directive", () => {
    writeTestConfig(tempDir, defaultConfig());

    const output = runPrime(tempDir);

    expect(output).toContain("Server Verification Directive");
    expect(output).toContain("4777");
  });

  it("output includes tags from config", () => {
    writeTestConfig(tempDir, defaultConfig({ tags: ["arch", "security"] }));

    const output = runPrime(tempDir);

    expect(output).toContain("Tags: arch, security");
  });

  it("output includes prefix from config", () => {
    writeTestConfig(tempDir, defaultConfig({ prefix: "myapp-" }));

    const output = runPrime(tempDir);

    expect(output).toContain("Prefix: myapp-");
  });
});
