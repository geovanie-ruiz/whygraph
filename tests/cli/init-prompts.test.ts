/**
 * Tests for runInit paths that invoke `prompts` (interactive branches).
 * vi.mock is hoisted so prompts is intercepted in init.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("prompts", () => ({ default: vi.fn() }));

import prompts from "prompts";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-init-prompts-test-"));
}

describe("runInit (prompts paths)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    vi.mocked(prompts).mockReset();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("calls prompts when appName and environment are missing", async () => {
    vi.mocked(prompts).mockResolvedValue({ appName: "PromptedApp", environment: "claude-code" });

    const { runInit } = await import("../../src/cli/commands/init.js");
    const result = await runInit(tempDir, {});

    expect(vi.mocked(prompts)).toHaveBeenCalledOnce();
    expect(result.appId).toBeDefined();
  });

  it("calls prompts only for missing environment when appName is provided", async () => {
    vi.mocked(prompts).mockResolvedValue({ environment: "cursor" });

    const { runInit } = await import("../../src/cli/commands/init.js");
    const result = await runInit(tempDir, { appName: "MyApp" });

    expect(vi.mocked(prompts)).toHaveBeenCalledOnce();
    expect(result.appId).toBeDefined();
  });

  it("throws when prompts returns empty appName", async () => {
    vi.mocked(prompts).mockResolvedValue({ appName: "", environment: "claude-code" });

    const { runInit } = await import("../../src/cli/commands/init.js");
    await expect(runInit(tempDir, {})).rejects.toThrow(/App name is required/);
  });

  it("throws when prompts returns undefined environment", async () => {
    vi.mocked(prompts).mockResolvedValue({ appName: "TestApp", environment: undefined });

    const { runInit } = await import("../../src/cli/commands/init.js");
    await expect(runInit(tempDir, {})).rejects.toThrow(/Environment is required/);
  });

  it("throws when user cancels prompts", async () => {
    vi.mocked(prompts).mockImplementation(
      async (_questions: unknown, options: { onCancel?: () => void } = {}) => {
        if (options?.onCancel) options.onCancel();
        return {};
      },
    );

    const { runInit } = await import("../../src/cli/commands/init.js");
    await expect(runInit(tempDir, {})).rejects.toThrow(/cancelled/i);
  });
});
