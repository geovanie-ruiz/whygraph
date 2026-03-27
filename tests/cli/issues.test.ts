import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import * as yaml from "js-yaml";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(tmpdir(), "whygraph-issues-test-"));
}

function setupProject(dir: string): string {
  const whygraphDir = path.join(dir, ".whygraph");
  const graphDir = path.join(whygraphDir, "graph");
  fs.mkdirSync(graphDir, { recursive: true });
  fs.writeFileSync(
    path.join(whygraphDir, "config.yaml"),
    yaml.dump({ serverPort: 4777, appName: "Test", prefix: "wg-", idLength: 4 }),
  );
  return whygraphDir;
}

function writeDecision(graphDir: string, id: string, overrides: Record<string, unknown> = {}): void {
  const frontmatter = {
    id,
    label: "Decision",
    title: "Test Decision",
    status: "active",
    date: "2026-03-26",
    affects: [],
    tags: ["arch"],
    created_at: "2026-03-26T00:00:00Z",
    updated_at: "2026-03-26T00:00:00Z",
    ...overrides,
  };
  const content = `---\n${yaml.dump(frontmatter)}---\n\n## Context\nsome context\n\n## Decision\nsome decision\n\n## Tradeoffs\nsome tradeoffs\n\n## Alternatives\nnone\n`;
  fs.writeFileSync(path.join(graphDir, `${id}--test.md`), content);
}

describe("runIssues", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("throws when .whygraph not found", async () => {
    const { runIssues } = await import("../../src/cli/commands/issues.js");
    await expect(async () => runIssues(tempDir)).rejects.toThrow(/not found/);
  });

  it("returns zero issues for a clean graph", async () => {
    const whygraphDir = setupProject(tempDir);
    writeDecision(path.join(whygraphDir, "graph"), "wg-d001");

    const { runIssues } = await import("../../src/cli/commands/issues.js");
    const result = runIssues(tempDir);
    expect(result.total).toBe(0);
    expect(result.agentNeeded).toBe(0);
    expect(result.cliResolvable).toBe(0);
  });

  it("returns issues array when validation errors exist", async () => {
    const whygraphDir = setupProject(tempDir);
    const graphDir = path.join(whygraphDir, "graph");

    // Write a decision with invalid tag → will create an issue in the issues store
    // First write a valid decision, then corrupt it to bypass write-time validation
    writeDecision(graphDir, "wg-d002", { tags: ["bad-tag"] });

    // Force an issue file to be present
    const issuesDir = path.join(whygraphDir, "issues");
    fs.mkdirSync(issuesDir, { recursive: true });
    const issue = {
      entityId: "wg-d002",
      errors: [{ field: "tags", message: 'invalid tag "bad-tag"' }],
    };
    fs.writeFileSync(path.join(issuesDir, "wg-d002.json"), JSON.stringify(issue));

    const { runIssues } = await import("../../src/cli/commands/issues.js");
    const result = runIssues(tempDir);
    expect(result.total).toBeGreaterThanOrEqual(1);
    const found = result.issues.find((i) => i.entityId === "wg-d002");
    expect(found).toBeDefined();
  });

  it("classifies issues as cliResolvable when fields are fixable", async () => {
    const whygraphDir = setupProject(tempDir);
    const issuesDir = path.join(whygraphDir, "issues");
    fs.mkdirSync(issuesDir, { recursive: true });

    // tags, parent, date, affects, supersedes are CLI-resolvable
    const issue = {
      entityId: "wg-d003",
      errors: [{ field: "tags", message: 'invalid tag "bad-tag"' }],
    };
    fs.writeFileSync(path.join(issuesDir, "wg-d003.json"), JSON.stringify(issue));

    const { runIssues } = await import("../../src/cli/commands/issues.js");
    const result = runIssues(tempDir);
    expect(result.cliResolvable).toBeGreaterThanOrEqual(1);
    expect(result.agentNeeded).toBe(0);
  });

  it("classifies issues as agentNeeded when fields require content", async () => {
    const whygraphDir = setupProject(tempDir);
    const issuesDir = path.join(whygraphDir, "issues");
    fs.mkdirSync(issuesDir, { recursive: true });

    // context and decision are agent-needed fields
    const issue = {
      entityId: "wg-d004",
      errors: [{ field: "context", message: "missing context" }],
    };
    fs.writeFileSync(path.join(issuesDir, "wg-d004.json"), JSON.stringify(issue));

    const { runIssues } = await import("../../src/cli/commands/issues.js");
    const result = runIssues(tempDir);
    expect(result.agentNeeded).toBeGreaterThanOrEqual(1);
    expect(result.cliResolvable).toBe(0);
  });
});
