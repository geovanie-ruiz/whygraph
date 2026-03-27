import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";

// vi.mock is hoisted — these intercept the static imports in restart.ts
vi.mock("../../src/cli/commands/down.js", () => ({
  runDown: vi.fn(),
  registerDownCommand: vi.fn(),
}));
vi.mock("../../src/cli/commands/up.js", () => ({
  runUp: vi.fn(),
  registerUpCommand: vi.fn(),
}));

import * as downMod from "../../src/cli/commands/down.js";
import * as upMod from "../../src/cli/commands/up.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(tmpdir(), "whygraph-restart-test-"));
}

describe("runRestart", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    vi.mocked(downMod.runDown).mockResolvedValue({ stopped: false, port: 4777 });
    vi.mocked(upMod.runUp).mockResolvedValue({ url: "http://localhost:4777", port: 4777, pid: 12345 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("composes runDown and runUp results", async () => {
    vi.mocked(downMod.runDown).mockResolvedValue({ stopped: true, port: 4777 });

    const { runRestart } = await import("../../src/cli/commands/restart.js");
    const result = await runRestart(tempDir);

    expect(result.stopped).toBe(true);
    expect(result.url).toBe("http://localhost:4777");
    expect(result.port).toBe(4777);
    expect(result.pid).toBe(12345);
  });

  it("returns stopped: false when server was not running", async () => {
    const { runRestart } = await import("../../src/cli/commands/restart.js");
    const result = await runRestart(tempDir);

    expect(result.stopped).toBe(false);
    expect(result.url).toBe("http://localhost:4777");
  });

  it("propagates runDown errors", async () => {
    vi.mocked(downMod.runDown).mockRejectedValue(new Error(".whygraph/ not found"));

    const { runRestart } = await import("../../src/cli/commands/restart.js");
    await expect(runRestart(tempDir)).rejects.toThrow(/not found/);
  });

  it("propagates runUp errors", async () => {
    vi.mocked(upMod.runUp).mockRejectedValue(new Error("Server already running"));

    const { runRestart } = await import("../../src/cli/commands/restart.js");
    await expect(runRestart(tempDir)).rejects.toThrow(/running/);
  });
});
