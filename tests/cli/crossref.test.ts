import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";
import yaml from "js-yaml";
import { runCrossref } from "../../src/cli/commands/crossref.js";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-crossref-test-"));
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

function writeNode(dir: string, id: string, label: string, name: string, parent?: string): void {
  const lines = [
    "---",
    `id: ${id}`,
    `label: ${label}`,
    `name: ${name}`,
    "status: active",
    ...(parent ? [`parent: ${parent}`] : []),
    `created_at: ${new Date().toISOString()}`,
    `updated_at: ${new Date().toISOString()}`,
    "---",
    "",
  ];
  writeFileSync(join(dir, ".whygraph", "graph", `${id}.md`), lines.join("\n"), "utf-8");
}

function writeDecision(dir: string, id: string, title: string, affects: string[]): void {
  const affectsYaml = affects.length > 0
    ? ["affects:", ...affects.map((a) => `  - ${a}`)]
    : ["affects: []"];
  const lines = [
    "---",
    `id: ${id}`,
    "label: Decision",
    `title: ${title}`,
    "status: active",
    "date: 2024-01-01",
    ...affectsYaml,
    "tags:",
    "  - arch",
    `created_at: ${new Date().toISOString()}`,
    `updated_at: ${new Date().toISOString()}`,
    "---",
    "",
    "## Context",
    "why it was needed",
    "",
    "## Decision",
    "what was decided",
    "",
    "## Tradeoffs",
    "what was gained",
    "",
    "## Alternatives",
    "what was rejected",
    "",
  ];
  writeFileSync(join(dir, ".whygraph", "graph", `${id}.md`), lines.join("\n"), "utf-8");
}

describe("runCrossref", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes CONTEXT.md and returns counts", () => {
    writeConfig(tempDir);
    writeNode(tempDir, "wg-app1", "App", "TestApp");
    writeDecision(tempDir, "wg-d001", "Use GraphQL", ["wg-app1"]);

    const result = runCrossref(tempDir);

    expect(result.outputPath).toBe(join(tempDir, ".whygraph", "CONTEXT.md"));
    expect(result.nodeCount).toBe(1);
    expect(result.decisionCount).toBe(1);
    expect(existsSync(result.outputPath)).toBe(true);
  });

  it("CONTEXT.md includes graph structure section", () => {
    writeConfig(tempDir);
    writeNode(tempDir, "wg-app1", "App", "TestApp");
    writeNode(tempDir, "wg-ft01", "Feature", "Auth", "wg-app1");
    writeNode(tempDir, "wg-cp01", "Component", "LoginForm", "wg-ft01");

    const { outputPath } = runCrossref(tempDir);
    const content = readFileSync(outputPath, "utf-8");

    expect(content).toContain("**App** `wg-app1` — TestApp");
    expect(content).toContain("**Feature** `wg-ft01` — Auth");
    expect(content).toContain("**Component** `wg-cp01` — LoginForm");
  });

  it("CONTEXT.md includes decision details", () => {
    writeConfig(tempDir);
    writeNode(tempDir, "wg-app1", "App", "TestApp");
    writeDecision(tempDir, "wg-d001", "Use GraphQL", ["wg-app1"]);

    const { outputPath } = runCrossref(tempDir);
    const content = readFileSync(outputPath, "utf-8");

    expect(content).toContain("[wg-d001] Use GraphQL");
    expect(content).toContain("why it was needed");
    expect(content).toContain("what was decided");
    expect(content).toContain("`wg-app1` (TestApp)");
  });

  it("resolves affected node names in decisions", () => {
    writeConfig(tempDir);
    writeNode(tempDir, "wg-app1", "App", "MyApp");
    writeNode(tempDir, "wg-ft01", "Feature", "Payments", "wg-app1");
    writeDecision(tempDir, "wg-d001", "Stripe over PayPal", ["wg-ft01"]);

    const { outputPath } = runCrossref(tempDir);
    const content = readFileSync(outputPath, "utf-8");

    expect(content).toContain("`wg-ft01` (Payments)");
  });

  it("handles decision affecting unknown id", () => {
    writeConfig(tempDir);
    writeNode(tempDir, "wg-app1", "App", "TestApp");
    writeDecision(tempDir, "wg-d001", "Some decision", ["wg-unkn"]);

    const { outputPath } = runCrossref(tempDir);
    const content = readFileSync(outputPath, "utf-8");

    // Unknown ID rendered without a name
    expect(content).toContain("`wg-unkn`");
  });

  it("renders 'No decisions' when graph has none", () => {
    writeConfig(tempDir);
    writeNode(tempDir, "wg-app1", "App", "TestApp");

    const { outputPath } = runCrossref(tempDir);
    const content = readFileSync(outputPath, "utf-8");

    expect(content).toContain("No decisions recorded yet");
  });

  it("handles orphaned features (no parent app)", () => {
    writeConfig(tempDir);
    writeNode(tempDir, "wg-ft01", "Feature", "OrphanFeature");

    const { outputPath } = runCrossref(tempDir);
    const content = readFileSync(outputPath, "utf-8");

    expect(content).toContain("OrphanFeature");
    expect(content).toContain("_(unlinked)_");
  });

  it("renders components under orphaned features", () => {
    writeConfig(tempDir);
    writeNode(tempDir, "wg-ft01", "Feature", "OrphanFeature");
    writeNode(tempDir, "wg-cp01", "Component", "OrphanComp", "wg-ft01");

    const { outputPath } = runCrossref(tempDir);
    const content = readFileSync(outputPath, "utf-8");

    expect(content).toContain("OrphanFeature");
    expect(content).toContain("OrphanComp");
  });

  it("handles empty graph directory", () => {
    writeConfig(tempDir);
    // graph dir exists but is empty

    const result = runCrossref(tempDir);

    expect(result.nodeCount).toBe(0);
    expect(result.decisionCount).toBe(0);
  });

  it("handles missing graph directory", () => {
    writeConfig(tempDir);
    rmSync(join(tempDir, ".whygraph", "graph"), { recursive: true });

    const result = runCrossref(tempDir);

    expect(result.nodeCount).toBe(0);
    expect(result.decisionCount).toBe(0);
  });

  it("skips unparseable .md files in graph dir", () => {
    writeConfig(tempDir);
    writeNode(tempDir, "wg-app1", "App", "TestApp");
    // Write a .md file with no YAML frontmatter — parseEntity returns null
    writeFileSync(join(tempDir, ".whygraph", "graph", "bad.md"), "not valid frontmatter\n", "utf-8");

    const result = runCrossref(tempDir);
    expect(result.nodeCount).toBe(1); // bad.md was skipped
  });

  it("renders decision with empty affects list", () => {
    writeConfig(tempDir);
    writeNode(tempDir, "wg-app1", "App", "TestApp");
    writeDecision(tempDir, "wg-d001", "No affects decision", []);

    const { outputPath } = runCrossref(tempDir);
    const content = readFileSync(outputPath, "utf-8");

    expect(content).toContain("[wg-d001] No affects decision");
    // Affects line should not appear when list is empty
    expect(content).not.toContain("**Affects:**");
  });

  it("throws when .whygraph/ is not found", () => {
    expect(() => runCrossref(tempDir)).toThrow(/not found/);
  });
});

describe("registerCrossrefCommand", () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    writeConfig(tempDir);
    writeNode(tempDir, "wg-app1", "App", "TestApp");
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("outputs text summary by default", async () => {
    const { registerCrossrefCommand } = await import("../../src/cli/commands/crossref.js");
    const program = new Command();
    registerCrossrefCommand(program);
    program.parse(["node", "whygraph", "crossref"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("CONTEXT.md");
    expect(output).toContain("Nodes: 1");
    expect(output).toContain("Decisions: 0");
    expect(cwdSpy).toHaveBeenCalled();
  });

  it("outputs JSON when --json flag is set", async () => {
    const { registerCrossrefCommand } = await import("../../src/cli/commands/crossref.js");
    const program = new Command();
    registerCrossrefCommand(program);
    program.parse(["node", "whygraph", "crossref", "--json"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed.nodeCount).toBe(1);
    expect(parsed.decisionCount).toBe(0);
    expect(parsed.outputPath).toContain("CONTEXT.md");
  });

  it("writes error to stderr on failure", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    cwdSpy.mockReturnValue(makeTempDir());

    const { registerCrossrefCommand } = await import("../../src/cli/commands/crossref.js");
    const program = new Command();
    registerCrossrefCommand(program);
    program.parse(["node", "whygraph", "crossref"]);

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Error:"));
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    stderrSpy.mockRestore();
  });

  it("outputs JSON error when --json flag is set on failure", async () => {
    cwdSpy.mockReturnValue(makeTempDir());

    const { registerCrossrefCommand } = await import("../../src/cli/commands/crossref.js");
    const program = new Command();
    registerCrossrefCommand(program);
    program.parse(["node", "whygraph", "crossref", "--json"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed.error).toMatch(/not found/);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
