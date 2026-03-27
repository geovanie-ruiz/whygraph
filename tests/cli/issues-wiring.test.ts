/**
 * Tests for registerIssuesCommand CLI wiring — specifically the error paths
 * that are not covered by the runIssues unit tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-issues-wiring-test-"));
}

describe("registerIssuesCommand error paths", () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes error to stderr when .whygraph not found (no --json)", async () => {
    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    const errOutput = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(errOutput).toContain("Error:");
    expect(cwdSpy).toHaveBeenCalled();
  });

  it("writes json error to stdout when .whygraph not found with --json", async () => {
    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues", "--json"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("error");
  });
});
