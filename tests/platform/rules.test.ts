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
    expect(mcp.mcpServers.whygraph.command).toBe("npx");
    expect(mcp.mcpServers.whygraph.args[0]).toBe("whygraph");
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

  it("copilot: writes to .github/copilot-instructions.md", () => {
    const result = writePlatformRules(tempDir, "copilot", "", TEST_CONFIG);

    expect(result.environment).toBe("copilot");
    expect(result.filePath).toBe(join(tempDir, ".github", "copilot-instructions.md"));
    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toContain("<!-- whygraph:start -->");
  });

  it("copilot: writes to .github/copilot-instructions.md when .github already exists", () => {
    mkdirSync(join(tempDir, ".github"), { recursive: true });
    const result = writePlatformRules(tempDir, "copilot", "", TEST_CONFIG);

    expect(result.filePath).toBe(join(tempDir, ".github", "copilot-instructions.md"));
  });

  it("copilot: upserts when copilot-instructions.md already exists", () => {
    writePlatformRules(tempDir, "copilot", "", TEST_CONFIG);
    const result = writePlatformRules(tempDir, "copilot", "", TEST_CONFIG);

    const content = readFileSync(result.filePath, "utf-8");
    const matches = content.match(/<!-- whygraph:start -->/g);
    expect(matches).toHaveLength(1);
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

  it("cursor: registers MCP in .cursor/mcp.json", () => {
    writePlatformRules(tempDir, "cursor", "", TEST_CONFIG);

    const mcpPath = join(tempDir, ".cursor", "mcp.json");
    expect(existsSync(mcpPath)).toBe(true);
    const mcp = JSON.parse(readFileSync(mcpPath, "utf-8"));
    expect(mcp.mcpServers.whygraph).toBeDefined();
  });

  it("cursor: does not duplicate MCP entry on re-run", () => {
    writePlatformRules(tempDir, "cursor", "", TEST_CONFIG);
    writePlatformRules(tempDir, "cursor", "", TEST_CONFIG);

    const mcpPath = join(tempDir, ".cursor", "mcp.json");
    const mcp = JSON.parse(readFileSync(mcpPath, "utf-8"));
    expect(Object.keys(mcp.mcpServers)).toHaveLength(1);
  });

  it("copilot: registers MCP in .vscode/mcp.json", () => {
    writePlatformRules(tempDir, "copilot", "", TEST_CONFIG);

    const mcpPath = join(tempDir, ".vscode", "mcp.json");
    expect(existsSync(mcpPath)).toBe(true);
    const mcp = JSON.parse(readFileSync(mcpPath, "utf-8"));
    expect(mcp.servers.whygraph).toBeDefined();
  });

  it("copilot: merges with existing .vscode/mcp.json", () => {
    mkdirSync(join(tempDir, ".vscode"), { recursive: true });
    writeFileSync(
      join(tempDir, ".vscode", "mcp.json"),
      JSON.stringify({ servers: { othertool: { command: "othertool" } } }, null, 2),
      "utf-8",
    );

    writePlatformRules(tempDir, "copilot", "", TEST_CONFIG);

    const mcp = JSON.parse(readFileSync(join(tempDir, ".vscode", "mcp.json"), "utf-8"));
    expect(mcp.servers.whygraph).toBeDefined();
    expect(mcp.servers.othertool).toBeDefined();
  });

  it("other: writes MCP_SETUP.md", () => {
    const result = writePlatformRules(tempDir, "other", "", TEST_CONFIG);

    expect(result.mcpRegistered).toBe(false);
    expect(result.mcpSetupPath).toBeDefined();
    const content = readFileSync(result.mcpSetupPath!, "utf-8");
    expect(content).toContain("whygraph MCP");
  });

  it("cursor: falls back to MCP_SETUP.md when .cursor dir cannot be created", () => {
    // Make .cursor a file so mkdirSync throws
    writeFileSync(join(tempDir, ".cursor"), "not a dir", "utf-8");

    const result = writePlatformRules(tempDir, "cursor", "", TEST_CONFIG);

    expect(result.mcpRegistered).toBe(false);
    expect(result.mcpSetupPath).toBeDefined();
    const content = readFileSync(result.mcpSetupPath!, "utf-8");
    // cursor case in writeMcpSetupMd includes cursor JSON
    expect(content).toContain("whygraph");
  });

  it("copilot: falls back to MCP_SETUP.md when .vscode dir cannot be created", () => {
    // Make .vscode a file so mkdirSync throws
    writeFileSync(join(tempDir, ".vscode"), "not a dir", "utf-8");

    const result = writePlatformRules(tempDir, "copilot", "", TEST_CONFIG);

    expect(result.mcpRegistered).toBe(false);
    expect(result.mcpSetupPath).toBeDefined();
    const content = readFileSync(result.mcpSetupPath!, "utf-8");
    // copilot case in writeMcpSetupMd includes copilot JSON
    expect(content).toContain("whygraph");
  });

  it("claude-code: falls back to MCP_SETUP.md when both claude CLI and .mcp.json fail", () => {
    // Make .mcp.json a directory so writeFileSync fails in the fallback
    mkdirSync(join(tempDir, ".mcp.json"), { recursive: true });

    const result = writePlatformRules(tempDir, "claude-code", "", TEST_CONFIG);

    // registerMcpWithClaude returns false, so writeMcpSetupMd is called with "claude-code"
    expect(result.mcpRegistered).toBe(false);
    expect(result.mcpSetupPath).toBeDefined();
    const content = readFileSync(result.mcpSetupPath!, "utf-8");
    expect(content).toContain("whygraph");
  });

  it("uses _primeOutput when config is not provided", () => {
    const result = writePlatformRules(tempDir, "cursor", "custom agent instructions");

    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toContain("custom agent instructions");
  });
});
