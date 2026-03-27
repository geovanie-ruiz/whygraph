/**
 * Tests for registerServeCommand CLI wiring.
 * vi.mock intercepts the dependencies that runServe uses, so the real
 * registerServeCommand → runServe path runs but without side effects.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";
import yaml from "js-yaml";

// Mock the HTTP server so runServe doesn't try to bind a real port
vi.mock("../../src/server/http.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/server/http.js")>();
  return {
    ...actual,
    createHttpServer: vi.fn().mockReturnValue({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      server: { address: () => ({ port: 4777 }) },
    }),
  };
});

// Mock file watcher so no chokidar is started
vi.mock("../../src/server/watcher.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/server/watcher.js")>();
  const MockFileWatcher = vi.fn(function MockFileWatcher() {
    return { start: vi.fn(), stop: vi.fn().mockResolvedValue(undefined) };
  });
  return { ...actual, FileWatcher: MockFileWatcher };
});

// Mock worktree watcher so no git operations run
vi.mock("../../src/server/worktree-watcher.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/server/worktree-watcher.js")>();
  const MockWorktreeWatcher = vi.fn(function MockWorktreeWatcher() {
    return {
      startWatching: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };
  });
  return { ...actual, WorktreeWatcher: MockWorktreeWatcher };
});

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-serve-wiring-test-"));
}

function setupProject(dir: string): void {
  mkdirSync(join(dir, ".whygraph", "graph"), { recursive: true });
  writeFileSync(
    join(dir, ".whygraph", "config.yaml"),
    yaml.dump({ appName: "Test", prefix: "wg-", idLength: 4, serverPort: 4777 }),
  );
}

describe("registerServeCommand", () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    setupProject(tempDir);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("outputs server running message", async () => {
    const { registerServeCommand } = await import("../../src/cli/commands/serve.js");
    const program = new Command();
    registerServeCommand(program);
    await program.parseAsync(["node", "whygraph", "serve", "--port", "4777"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("4777");
    expect(cwdSpy).toHaveBeenCalled();
  });

  it("outputs json when --json flag is set", async () => {
    const { registerServeCommand } = await import("../../src/cli/commands/serve.js");
    const program = new Command();
    registerServeCommand(program);
    await program.parseAsync(["node", "whygraph", "serve", "--port", "4777", "--json"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("url");
    expect(parsed).toHaveProperty("entities");
  });

  it("outputs stderr error when serve fails", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const emptyDir = makeTempDir(); // no .whygraph
    cwdSpy.mockReturnValue(emptyDir);

    const { registerServeCommand } = await import("../../src/cli/commands/serve.js");
    const program = new Command();
    registerServeCommand(program);
    await program.parseAsync(["node", "whygraph", "serve"]);

    const errOutput = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(errOutput).toContain("Error:");
    stderrSpy.mockRestore();
    rmSync(emptyDir, { recursive: true, force: true });
  });

  it("outputs json error when serve fails with --json", async () => {
    const emptyDir = makeTempDir(); // no .whygraph
    cwdSpy.mockReturnValue(emptyDir);

    const { registerServeCommand } = await import("../../src/cli/commands/serve.js");
    const program = new Command();
    registerServeCommand(program);
    await program.parseAsync(["node", "whygraph", "serve", "--json"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("error");
    rmSync(emptyDir, { recursive: true, force: true });
  });
});
