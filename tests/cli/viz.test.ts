/**
 * Tests for runViz and registerVizCommand.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";

// Mock node:child_process so no real process is spawned
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: vi.fn().mockReturnValue({ pid: 88888, unref: vi.fn() }),
  };
});

// Mock the "open" module so no browser is opened
vi.mock("open", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-viz-test-"));
}

function setupProject(dir: string): void {
  mkdirSync(join(dir, ".whygraph"), { recursive: true });
}

describe("runViz", () => {
  let tempDir: string;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("throws when .whygraph not found", async () => {
    const { runViz } = await import("../../src/cli/commands/viz.js");
    await expect(runViz(tempDir)).rejects.toThrow(/not found/);
  });

  it("returns url when server is already running", async () => {
    setupProject(tempDir);
    fetchMock.mockResolvedValueOnce({ ok: true });

    const { runViz } = await import("../../src/cli/commands/viz.js");
    const result = await runViz(tempDir, { port: 19999 });

    expect(result.url).toBe("http://localhost:19999");
    // spawn should NOT be called since server was running
    const { spawn } = await import("node:child_process");
    expect(spawn).not.toHaveBeenCalled();
  });

  it("spawns server when not running and opens browser", async () => {
    setupProject(tempDir);
    // fetch throws (server not running)
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const { runViz } = await import("../../src/cli/commands/viz.js");
    const result = await runViz(tempDir, { port: 19998 });

    expect(result.url).toBe("http://localhost:19998");

    const { spawn } = await import("node:child_process");
    expect(spawn).toHaveBeenCalledWith(
      "whygraph",
      ["serve", "--port", "19998"],
      expect.objectContaining({ detached: true }),
    );

    const openMod = await import("open");
    expect(openMod.default).toHaveBeenCalledWith("http://localhost:19998");
  });

  it("uses default port 4777 when none specified", async () => {
    setupProject(tempDir);
    fetchMock.mockResolvedValueOnce({ ok: true });

    const { runViz } = await import("../../src/cli/commands/viz.js");
    const result = await runViz(tempDir);

    expect(result.url).toBe("http://localhost:4777");
  });

  it("returns url even when server health check returns non-ok", async () => {
    setupProject(tempDir);
    // health returns ok: false → serverRunning stays false → spawn
    fetchMock.mockResolvedValueOnce({ ok: false });

    const { runViz } = await import("../../src/cli/commands/viz.js");
    const result = await runViz(tempDir, { port: 19996 });

    expect(result.url).toBe("http://localhost:19996");
    const { spawn } = await import("node:child_process");
    expect(spawn).toHaveBeenCalled();
  });
});

describe("registerVizCommand", () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    setupProject(tempDir);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("outputs opening message with url", async () => {
    const { registerVizCommand } = await import("../../src/cli/commands/viz.js");
    const program = new Command();
    registerVizCommand(program);
    await program.parseAsync(["node", "whygraph", "viz", "--port", "19997"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("19997");
    expect(cwdSpy).toHaveBeenCalled();
  });

  it("outputs json when --json flag set", async () => {
    const { registerVizCommand } = await import("../../src/cli/commands/viz.js");
    const program = new Command();
    registerVizCommand(program);
    await program.parseAsync(["node", "whygraph", "viz", "--port", "19997", "--json"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("url");
  });

  it("outputs stderr error when not in project", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const emptyDir = makeTempDir();
    cwdSpy.mockReturnValue(emptyDir);

    const { registerVizCommand } = await import("../../src/cli/commands/viz.js");
    const program = new Command();
    registerVizCommand(program);
    await program.parseAsync(["node", "whygraph", "viz"]);

    const errOutput = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(errOutput).toContain("Error:");
    stderrSpy.mockRestore();
    rmSync(emptyDir, { recursive: true, force: true });
  });

  it("outputs json error when not in project with --json", async () => {
    const emptyDir = makeTempDir();
    cwdSpy.mockReturnValue(emptyDir);

    const { registerVizCommand } = await import("../../src/cli/commands/viz.js");
    const program = new Command();
    registerVizCommand(program);
    await program.parseAsync(["node", "whygraph", "viz", "--json"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("error");
    rmSync(emptyDir, { recursive: true, force: true });
  });
});
