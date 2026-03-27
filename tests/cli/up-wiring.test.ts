/**
 * Tests for registerUpCommand CLI wiring.
 * vi.mock is hoisted so runUp is intercepted within up.ts's own action handler.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";
import yaml from "js-yaml";

// We can't vi.mock up.js itself (it would remove registerUpCommand too).
// Instead, mock the dependencies that runUp uses, so the real runUp runs
// but doesn't actually spawn or wait.
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: vi.fn().mockReturnValue({ pid: 77777, unref: vi.fn() }),
  };
});

vi.mock("../../src/cli/commands/server-utils.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/cli/commands/server-utils.js")>();
  return {
    ...actual,
    isServerRunning: vi.fn().mockReturnValue(false),
    waitForServerReady: vi.fn().mockResolvedValue(undefined),
  };
});

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-up-wiring-test-"));
}

function setupProject(dir: string, port = 4777): void {
  mkdirSync(join(dir, ".whygraph"), { recursive: true });
  writeFileSync(
    join(dir, ".whygraph", "config.yaml"),
    yaml.dump({ serverPort: port, appName: "Test", prefix: "wg-", idLength: 4 }),
  );
}

describe("registerUpCommand", () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    setupProject(tempDir, 19890);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("outputs server running message", async () => {
    const { registerUpCommand } = await import("../../src/cli/commands/up.js");
    const program = new Command();
    registerUpCommand(program);
    await program.parseAsync(["node", "whygraph", "up", "--port", "19890"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("19890");
    expect(cwdSpy).toHaveBeenCalled();
  });

  it("outputs json when --json flag is set", async () => {
    const { registerUpCommand } = await import("../../src/cli/commands/up.js");
    const program = new Command();
    registerUpCommand(program);
    await program.parseAsync(["node", "whygraph", "up", "--port", "19890", "--json"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("url");
    expect(parsed).toHaveProperty("port");
    expect(parsed).toHaveProperty("pid");
  });

  it("outputs stderr error when up fails", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const emptyDir = makeTempDir(); // no .whygraph
    cwdSpy.mockReturnValue(emptyDir);

    const { registerUpCommand } = await import("../../src/cli/commands/up.js");
    const program = new Command();
    registerUpCommand(program);
    await program.parseAsync(["node", "whygraph", "up"]);

    const errOutput = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(errOutput).toContain("Error:");
    stderrSpy.mockRestore();
    rmSync(emptyDir, { recursive: true, force: true });
  });

  it("outputs json error when up fails with --json", async () => {
    const emptyDir = makeTempDir(); // no .whygraph
    cwdSpy.mockReturnValue(emptyDir);

    const { registerUpCommand } = await import("../../src/cli/commands/up.js");
    const program = new Command();
    registerUpCommand(program);
    await program.parseAsync(["node", "whygraph", "up", "--json"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("error");
    rmSync(emptyDir, { recursive: true, force: true });
  });
});
