import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import * as yaml from "js-yaml";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(tmpdir(), "whygraph-down-test-"));
}

function setupProject(dir: string, port = 4777): void {
  const whygraphDir = path.join(dir, ".whygraph");
  fs.mkdirSync(whygraphDir, { recursive: true });
  fs.writeFileSync(
    path.join(whygraphDir, "config.yaml"),
    yaml.dump({ serverPort: port }),
  );
}

describe("runDown", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("throws when .whygraph not found", async () => {
    const { runDown } = await import("../../src/cli/commands/down.js");
    await expect(runDown(tempDir)).rejects.toThrow(/not found/);
  });

  it("returns stopped: false when no server running", async () => {
    setupProject(tempDir, 19878);
    const { runDown } = await import("../../src/cli/commands/down.js");
    const result = await runDown(tempDir, { port: 19878 });
    expect(result.stopped).toBe(false);
    expect(result.port).toBe(19878);
  });

  it("uses configured port from config.yaml", async () => {
    setupProject(tempDir, 19879);
    const { runDown } = await import("../../src/cli/commands/down.js");
    const result = await runDown(tempDir);
    expect(result.port).toBe(19879);
  });
});
