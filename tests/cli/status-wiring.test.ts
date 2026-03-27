/**
 * Tests for registerStatusCommand CLI wiring.
 * Mocks global fetch so runStatus doesn't hit real network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";
import yaml from "js-yaml";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-status-wiring-test-"));
}

function setupProject(dir: string, port = 4777): void {
  mkdirSync(join(dir, ".whygraph"), { recursive: true });
  writeFileSync(
    join(dir, ".whygraph", "config.yaml"),
    yaml.dump({ appName: "Test", prefix: "wg-", idLength: 4, serverPort: port }),
  );
}

function makeJsonResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
}

describe("registerStatusCommand", () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    setupProject(tempDir, 4777);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);

    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("outputs running message with counts", async () => {
    // health check ok, then graphql returns status
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(makeJsonResponse({
        data: { status: { running: true, entityCount: 5, nodeCount: 3, decisionCount: 2 } },
      }));

    const { registerStatusCommand } = await import("../../src/cli/commands/status.js");
    const program = new Command();
    registerStatusCommand(program);
    await program.parseAsync(["node", "whygraph", "status"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("running");
    expect(cwdSpy).toHaveBeenCalled();
  });

  it("outputs json when --json flag set", async () => {
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(makeJsonResponse({
        data: { status: { running: true, entityCount: 5, nodeCount: 3, decisionCount: 2 } },
      }));

    const { registerStatusCommand } = await import("../../src/cli/commands/status.js");
    const program = new Command();
    registerStatusCommand(program);
    await program.parseAsync(["node", "whygraph", "status", "--json"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed.serverRunning).toBe(true);
    expect(parsed.entityCount).toBe(5);
  });

  it("outputs not running message when server is down", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const { registerStatusCommand } = await import("../../src/cli/commands/status.js");
    const program = new Command();
    registerStatusCommand(program);
    await program.parseAsync(["node", "whygraph", "status"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("not running");
  });

  it("outputs stderr error when no .whygraph found", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const emptyDir = makeTempDir();
    cwdSpy.mockReturnValue(emptyDir);

    const { registerStatusCommand } = await import("../../src/cli/commands/status.js");
    const program = new Command();
    registerStatusCommand(program);
    await program.parseAsync(["node", "whygraph", "status"]);

    const errOutput = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(errOutput).toContain("Error:");
    stderrSpy.mockRestore();
    rmSync(emptyDir, { recursive: true, force: true });
  });

  it("outputs json error when no .whygraph found with --json", async () => {
    const emptyDir = makeTempDir();
    cwdSpy.mockReturnValue(emptyDir);

    const { registerStatusCommand } = await import("../../src/cli/commands/status.js");
    const program = new Command();
    registerStatusCommand(program);
    await program.parseAsync(["node", "whygraph", "status", "--json"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("error");
    rmSync(emptyDir, { recursive: true, force: true });
  });
});
