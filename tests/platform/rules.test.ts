import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writePlatformRules } from "../../src/platform/rules.js";
import type { WhygraphConfig } from "../../src/entity/types.js";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-platform-test-"));
}

const TEST_CONFIG: WhygraphConfig = {
  appName: "TestApp",
  environment: "claude-code",
  prefix: "wg-",
  idLength: 4,
  tags: ["arch", "data", "security", "performance", "integration", "infra", "ux"],
  mcpMode: "default",
  serverPort: 4777,
};

describe("writePlatformRules", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("claude-code: writes instructions to CLAUDE.md", () => {
    const result = writePlatformRules(tempDir, "claude-code", "", TEST_CONFIG);

    expect(result.environment).toBe("claude-code");
    expect(result.filePath).toBe(join(tempDir, "CLAUDE.md"));

    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toContain("<!-- whygraph:start -->");
    expect(content).toContain("Decision Capture");
    expect(content).toContain("<!-- whygraph:end -->");
  });

  it("claude-code: registers MCP server in settings.json", () => {
    writePlatformRules(tempDir, "claude-code", "", TEST_CONFIG);

    const settingsPath = join(tempDir, ".claude", "settings.json");
    expect(existsSync(settingsPath)).toBe(true);

    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    expect(settings.mcpServers.whygraph).toEqual({
      command: "whygraph",
      args: ["mcp"],
    });
  });

  it("claude-code: preserves existing settings.json content", () => {
    const settingsDir = join(tempDir, ".claude");
    mkdirSync(settingsDir, { recursive: true });
    writeFileSync(
      join(settingsDir, "settings.json"),
      JSON.stringify({ existingKey: true }, null, 2) + "\n",
      "utf-8",
    );

    writePlatformRules(tempDir, "claude-code", "", TEST_CONFIG);

    const settings = JSON.parse(readFileSync(join(settingsDir, "settings.json"), "utf-8"));
    expect(settings.existingKey).toBe(true);
    expect(settings.mcpServers.whygraph).toBeDefined();
  });

  it("claude-code: does not duplicate MCP server on re-run", () => {
    writePlatformRules(tempDir, "claude-code", "", TEST_CONFIG);
    writePlatformRules(tempDir, "claude-code", "", TEST_CONFIG);

    const settingsPath = join(tempDir, ".claude", "settings.json");
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    expect(Object.keys(settings.mcpServers)).toHaveLength(1);
  });

  it("cursor: writes to AGENTS.md", () => {
    const result = writePlatformRules(tempDir, "cursor", "", TEST_CONFIG);

    expect(result.environment).toBe("cursor");
    expect(result.filePath).toBe(join(tempDir, "AGENTS.md"));

    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toContain("Decision Capture");
    expect(content).toContain("<!-- whygraph:start -->");
  });

  it("copilot: writes to AGENTS.md", () => {
    const result = writePlatformRules(tempDir, "copilot", "", TEST_CONFIG);

    expect(result.environment).toBe("copilot");
    expect(result.filePath).toBe(join(tempDir, "AGENTS.md"));
  });

  it("other: writes to AGENTS.md", () => {
    const result = writePlatformRules(tempDir, "other", "", TEST_CONFIG);

    expect(result.environment).toBe("other");
    expect(result.filePath).toBe(join(tempDir, "AGENTS.md"));
  });

  it("replaces whygraph section on re-run", () => {
    writePlatformRules(tempDir, "cursor", "", TEST_CONFIG);
    writePlatformRules(tempDir, "cursor", "", { ...TEST_CONFIG, appName: "Updated" });

    const content = readFileSync(join(tempDir, "AGENTS.md"), "utf-8");
    const startCount = content.split("<!-- whygraph:start -->").length - 1;
    expect(startCount).toBe(1);
  });

  it("preserves existing AGENTS.md content", () => {
    writeFileSync(join(tempDir, "AGENTS.md"), "# Existing content\n", "utf-8");
    writePlatformRules(tempDir, "cursor", "", TEST_CONFIG);

    const content = readFileSync(join(tempDir, "AGENTS.md"), "utf-8");
    expect(content).toContain("# Existing content");
    expect(content).toContain("Decision Capture");
  });

  it("includes canonical tags in instructions", () => {
    const result = writePlatformRules(tempDir, "cursor", "", TEST_CONFIG);
    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toContain("arch, data, security, performance, integration, infra, ux");
  });

  it("includes recognition heuristic", () => {
    const result = writePlatformRules(tempDir, "cursor", "", TEST_CONFIG);
    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toContain("Choosing between alternatives");
    expect(content).toContain("Rejecting an approach");
  });
});
