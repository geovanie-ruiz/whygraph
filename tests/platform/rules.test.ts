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
import { writePlatformRules } from "../../src/platform/rules.js";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-platform-test-"));
}

const SAMPLE_PRIME = "# Whygraph Agent Instructions\n\nSome prime output.\n";

describe("writePlatformRules", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("claude-code: returns settings.json path", () => {
    const result = writePlatformRules(tempDir, "claude-code", SAMPLE_PRIME);

    expect(result.environment).toBe("claude-code");
    expect(result.filePath).toBe(join(tempDir, ".claude", "settings.json"));
  });

  it("cursor: creates .cursor/rules/whygraph.md", () => {
    const result = writePlatformRules(tempDir, "cursor", SAMPLE_PRIME);

    expect(result.environment).toBe("cursor");
    expect(result.filePath).toBe(join(tempDir, ".cursor", "rules", "whygraph.md"));

    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toBe(SAMPLE_PRIME);
  });

  it("copilot: appends to .github/copilot-instructions.md", () => {
    const result = writePlatformRules(tempDir, "copilot", SAMPLE_PRIME);

    expect(result.environment).toBe("copilot");
    expect(result.filePath).toBe(join(tempDir, ".github", "copilot-instructions.md"));

    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toContain("<!-- whygraph:start -->");
    expect(content).toContain(SAMPLE_PRIME);
    expect(content).toContain("<!-- whygraph:end -->");
  });

  it("copilot: appends to existing file", () => {
    const ghDir = join(tempDir, ".github");
    mkdirSync(ghDir, { recursive: true });
    writeFileSync(join(ghDir, "copilot-instructions.md"), "# Existing content\n", "utf-8");

    writePlatformRules(tempDir, "copilot", SAMPLE_PRIME);

    const content = readFileSync(join(ghDir, "copilot-instructions.md"), "utf-8");
    expect(content).toContain("# Existing content");
    expect(content).toContain(SAMPLE_PRIME);
  });

  it("copilot: replaces whygraph section on re-run", () => {
    writePlatformRules(tempDir, "copilot", SAMPLE_PRIME);
    writePlatformRules(tempDir, "copilot", "# Updated output\n");

    const content = readFileSync(join(tempDir, ".github", "copilot-instructions.md"), "utf-8");
    expect(content).not.toContain(SAMPLE_PRIME);
    expect(content).toContain("# Updated output");
    // Should only have one start marker
    const startCount = content.split("<!-- whygraph:start -->").length - 1;
    expect(startCount).toBe(1);
  });

  it("other: creates .whygraph/AGENT_CONTEXT.md", () => {
    mkdirSync(join(tempDir, ".whygraph"), { recursive: true });
    const result = writePlatformRules(tempDir, "other", SAMPLE_PRIME);

    expect(result.environment).toBe("other");
    expect(result.filePath).toBe(join(tempDir, ".whygraph", "AGENT_CONTEXT.md"));

    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toBe(SAMPLE_PRIME);
  });
});
