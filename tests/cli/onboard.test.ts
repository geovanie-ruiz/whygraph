import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";
import yaml from "js-yaml";
import { runOnboard } from "../../src/cli/commands/onboard.js";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-onboard-test-"));
}

function writeConfig(dir: string, appName = "TestApp"): void {
  mkdirSync(join(dir, ".whygraph", "graph"), { recursive: true });
  writeFileSync(
    join(dir, ".whygraph", "config.yaml"),
    yaml.dump({
      appName,
      environment: "claude-code",
      prefix: "wg-",
      idLength: 4,
      tags: ["arch"],
      mcpMode: "default",
      serverPort: 4777,
    }),
  );
}

function writeAppNode(dir: string, id: string, name: string): void {
  const content = [
    "---",
    `id: ${id}`,
    "label: App",
    `name: ${name}`,
    "status: active",
    `created_at: ${new Date().toISOString()}`,
    `updated_at: ${new Date().toISOString()}`,
    "---",
    "",
  ].join("\n");
  writeFileSync(join(dir, ".whygraph", "graph", `${id}.md`), content, "utf-8");
}

describe("runOnboard", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns appId, appName, prefix, and prompt", () => {
    writeConfig(tempDir, "MyApp");
    writeAppNode(tempDir, "wg-abcd", "MyApp");

    const result = runOnboard(tempDir);

    expect(result.appId).toBe("wg-abcd");
    expect(result.appName).toBe("MyApp");
    expect(result.prefix).toBe("wg-");
    expect(result.prompt).toContain("MyApp");
    expect(result.prompt).toContain("wg-abcd");
  });

  it("prompt instructs agent to create Feature and Component nodes", () => {
    writeConfig(tempDir, "MyApp");
    writeAppNode(tempDir, "wg-abcd", "MyApp");

    const { prompt } = runOnboard(tempDir);

    expect(prompt).toContain("Feature");
    expect(prompt).toContain("Component");
    expect(prompt).toContain("whygraph_create_node");
  });

  it("prompt includes the prefix", () => {
    writeConfig(tempDir, "MyApp");
    writeAppNode(tempDir, "wg-abcd", "MyApp");

    const { prompt } = runOnboard(tempDir);

    expect(prompt).toContain("wg-");
  });

  it("throws when .whygraph/ is not found", () => {
    expect(() => runOnboard(tempDir)).toThrow(/not found/);
  });

  it("throws when config.yaml is missing", () => {
    mkdirSync(join(tempDir, ".whygraph"), { recursive: true });
    expect(() => runOnboard(tempDir)).toThrow(/config.yaml not found/);
  });

  it("throws when no App node exists in graph/", () => {
    writeConfig(tempDir, "MyApp");
    // graph dir exists but is empty (no .md files with label: App)

    expect(() => runOnboard(tempDir)).toThrow(/No App node found/);
  });

  it("throws when graph dir does not exist", () => {
    // Write config but remove the graph dir
    writeConfig(tempDir, "MyApp");
    rmSync(join(tempDir, ".whygraph", "graph"), { recursive: true, force: true });

    expect(() => runOnboard(tempDir)).toThrow(/No App node found/);
  });

  it("throws when graph has only non-App nodes", () => {
    writeConfig(tempDir, "MyApp");
    // Write a Decision node file — label is not "App"
    const decisionContent = [
      "---",
      "id: wg-dcsc",
      "label: Decision",
      "title: Some decision",
      "status: active",
      "date: 2024-01-01",
      "tags:",
      "  - arch",
      `created_at: ${new Date().toISOString()}`,
      `updated_at: ${new Date().toISOString()}`,
      "---",
      "",
      "## Context",
      "context here",
      "",
      "## Decision",
      "decision here",
      "",
      "## Tradeoffs",
      "tradeoffs here",
      "",
      "## Alternatives",
      "alternatives here",
      "",
    ].join("\n");
    writeFileSync(join(tempDir, ".whygraph", "graph", "wg-dcsc.md"), decisionContent, "utf-8");

    expect(() => runOnboard(tempDir)).toThrow(/No App node found/);
  });
});

describe("registerOnboardCommand", () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    writeConfig(tempDir, "WiredApp");
    writeAppNode(tempDir, "wg-wxyz", "WiredApp");
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("outputs prompt text by default", async () => {
    const { registerOnboardCommand } = await import("../../src/cli/commands/onboard.js");
    const program = new Command();
    registerOnboardCommand(program);
    program.parse(["node", "whygraph", "onboard"]);
    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("Paste the following prompt");
    expect(output).toContain("WiredApp");
    expect(cwdSpy).toHaveBeenCalled();
  });

  it("outputs JSON when --json flag is set", async () => {
    const { registerOnboardCommand } = await import("../../src/cli/commands/onboard.js");
    const program = new Command();
    registerOnboardCommand(program);
    program.parse(["node", "whygraph", "onboard", "--json"]);
    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed.appId).toBe("wg-wxyz");
    expect(parsed.appName).toBe("WiredApp");
    expect(parsed.prompt).toContain("WiredApp");
  });

  it("writes error to stderr and sets exitCode on failure", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    cwdSpy.mockReturnValue(makeTempDir()); // dir with no .whygraph

    const { registerOnboardCommand } = await import("../../src/cli/commands/onboard.js");
    const program = new Command();
    registerOnboardCommand(program);
    program.parse(["node", "whygraph", "onboard"]);

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Error:"));
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    stderrSpy.mockRestore();
  });

  it("outputs JSON error when --json flag is set and run fails", async () => {
    cwdSpy.mockReturnValue(makeTempDir()); // dir with no .whygraph

    const { registerOnboardCommand } = await import("../../src/cli/commands/onboard.js");
    const program = new Command();
    registerOnboardCommand(program);
    program.parse(["node", "whygraph", "onboard", "--json"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed.error).toMatch(/not found/);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
