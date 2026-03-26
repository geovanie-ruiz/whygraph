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

  it("claude-code: registers MCP server via .mcp.json fallback when claude CLI unavailable", () => {
    writePlatformRules(tempDir, "claude-code", "", TEST_CONFIG);

    // In test environment, `claude mcp add` is unavailable so the fallback writes .mcp.json
    const mcpJsonPath = join(tempDir, ".mcp.json");
    expect(existsSync(mcpJsonPath)).toBe(true);

    const mcp = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
    expect(mcp.mcpServers.whygraph).toBeDefined();
    expect(mcp.mcpServers.whygraph.command).toBe("whygraph");
  });

  it("claude-code: does not duplicate MCP entry on re-run", () => {
    writePlatformRules(tempDir, "claude-code", "", TEST_CONFIG);
    writePlatformRules(tempDir, "claude-code", "", TEST_CONFIG);

    const mcpJsonPath = join(tempDir, ".mcp.json");
    const mcp = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
    expect(Object.keys(mcp.mcpServers)).toHaveLength(1);
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
