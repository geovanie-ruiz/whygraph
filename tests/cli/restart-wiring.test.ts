/**
 * Tests for registerRestartCommand CLI wiring.
 * vi.mock is hoisted so down.js and up.js are intercepted.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";
import yaml from "js-yaml";

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
  return mkdtempSync(join(tmpdir(), "whygraph-restart-wiring-test-"));
}

describe("registerRestartCommand", () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    mkdirSync(join(tempDir, ".whygraph"), { recursive: true });
    writeFileSync(
      join(tempDir, ".whygraph", "config.yaml"),
      yaml.dump({ serverPort: 4777, appName: "Test", prefix: "wg-", idLength: 4 }),
    );
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);

    vi.mocked(downMod.runDown).mockResolvedValue({ stopped: false, port: 4777 });
    vi.mocked(upMod.runUp).mockResolvedValue({ url: "http://localhost:4777", port: 4777, pid: 12345 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("outputs server running message after restart", async () => {
    const { registerRestartCommand } = await import("../../src/cli/commands/restart.js");
    const program = new Command();
    registerRestartCommand(program);
    await program.parseAsync(["node", "whygraph", "restart"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("http://localhost:4777");
    expect(output).toContain("12345");
    expect(cwdSpy).toHaveBeenCalled();
  });

  it("includes stopped message when server was running", async () => {
    vi.mocked(downMod.runDown).mockResolvedValue({ stopped: true, port: 4777 });

    const { registerRestartCommand } = await import("../../src/cli/commands/restart.js");
    const program = new Command();
    registerRestartCommand(program);
    await program.parseAsync(["node", "whygraph", "restart"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("Stopped previous server");
  });

  it("outputs json when --json flag is set", async () => {
    const { registerRestartCommand } = await import("../../src/cli/commands/restart.js");
    const program = new Command();
    registerRestartCommand(program);
    await program.parseAsync(["node", "whygraph", "restart", "--json"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("url");
    expect(parsed).toHaveProperty("port");
    expect(parsed).toHaveProperty("pid");
    expect(parsed).toHaveProperty("stopped");
  });

  it("outputs json error when restart fails", async () => {
    vi.mocked(downMod.runDown).mockRejectedValue(new Error(".whygraph/ not found"));

    const { registerRestartCommand } = await import("../../src/cli/commands/restart.js");
    const program = new Command();
    registerRestartCommand(program);
    await program.parseAsync(["node", "whygraph", "restart", "--json"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("error");
  });

  it("uses explicit port from --port flag", async () => {
    const { registerRestartCommand } = await import("../../src/cli/commands/restart.js");
    const program = new Command();
    registerRestartCommand(program);
    await program.parseAsync(["node", "whygraph", "restart", "--port", "4777"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("4777");
  });

  it("outputs stderr error when restart fails without --json", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.mocked(downMod.runDown).mockRejectedValue(new Error("something went wrong"));

    const { registerRestartCommand } = await import("../../src/cli/commands/restart.js");
    const program = new Command();
    registerRestartCommand(program);
    await program.parseAsync(["node", "whygraph", "restart"]);

    const errOutput = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(errOutput).toContain("Error:");
    stderrSpy.mockRestore();
  });
});
