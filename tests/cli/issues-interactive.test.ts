/**
 * Tests for the registerIssuesCommand interactive paths.
 * vi.mock is hoisted so prompts and server-utils are intercepted.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";
import yaml from "js-yaml";

vi.mock("prompts", () => ({ default: vi.fn() }));

import prompts from "prompts";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-issues-interactive-test-"));
}

function setupProject(dir: string): { whygraphDir: string; graphDir: string } {
  const whygraphDir = join(dir, ".whygraph");
  const graphDir = join(whygraphDir, "graph");
  mkdirSync(graphDir, { recursive: true });
  writeFileSync(
    join(whygraphDir, "config.yaml"),
    yaml.dump({ serverPort: 4777, appName: "Test", prefix: "wg-", idLength: 4 }),
  );
  return { whygraphDir, graphDir };
}

function writeIssue(whygraphDir: string, entityId: string, errors: Array<{ field: string; message: string }>): void {
  const issuesDir = join(whygraphDir, "issues");
  mkdirSync(issuesDir, { recursive: true });
  writeFileSync(join(issuesDir, `${entityId}.json`), JSON.stringify({ entityId, errors }));
}

function writeDecisionFile(graphDir: string, id: string): void {
  const md = `---
id: ${id}
label: Decision
title: Test Decision
status: active
date: "2026-03-24"
affects: []
tags:
  - arch
created_at: "2026-03-26T00:00:00Z"
updated_at: "2026-03-26T00:00:00Z"
---

## Context
some context

## Decision
some decision

## Tradeoffs
some tradeoffs

## Alternatives
none
`;
  writeFileSync(join(graphDir, `${id}--test.md`), md);
}

function writeFeatureFile(graphDir: string, id: string, name: string): void {
  const md = `---
id: ${id}
label: Feature
name: ${name}
status: active
created_at: "2026-03-26T00:00:00Z"
updated_at: "2026-03-26T00:00:00Z"
---
`;
  writeFileSync(join(graphDir, `${id}--test.md`), md);
}

describe("registerIssuesCommand (interactive)", () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = makeTempDir();
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    vi.mocked(prompts).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("outputs no issues for empty graph", async () => {
    setupProject(tempDir);

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("No issues");
  });

  it("outputs JSON for empty graph with --json", async () => {
    setupProject(tempDir);

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues", "--json"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed.total).toBe(0);
  });

  it("outputs agent issues inline when < 3", async () => {
    const { whygraphDir, graphDir } = setupProject(tempDir);
    writeDecisionFile(graphDir, "wg-d001");
    writeIssue(whygraphDir, "wg-d001", [{ field: "context", message: "missing context" }]);

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("[AGENT]");
  });

  it("writes AGENT_ISSUES.md when >= 3 agent issues", async () => {
    const { whygraphDir, graphDir } = setupProject(tempDir);
    for (let i = 1; i <= 3; i++) {
      writeDecisionFile(graphDir, `wg-d00${i}`);
      writeIssue(whygraphDir, `wg-d00${i}`, [{ field: "context", message: "missing context" }]);
    }

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("AGENT_ISSUES.md");
  });

  it("prompts to resolve tag issue when server is running", async () => {
    const { whygraphDir, graphDir } = setupProject(tempDir);
    writeDecisionFile(graphDir, "wg-d010");
    writeIssue(whygraphDir, "wg-d010", [{ field: "tags", message: 'invalid tag "bad-tag"' }]);

    // Mock isServerRunning to return true
    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(true);

    // Mock prompts to pick a replacement tag
    vi.mocked(prompts).mockResolvedValue({ tag: "arch" });

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    expect(vi.mocked(prompts)).toHaveBeenCalled();
  });

  it("prompts to resolve parent issue when server is running", async () => {
    const { whygraphDir, graphDir } = setupProject(tempDir);
    writeFeatureFile(graphDir, "wg-feat1", "AuthFeature");

    // Write a component with a missing parent issue
    const compMd = `---
id: wg-comp1
label: Component
name: LoginButton
status: active
created_at: "2026-03-26T00:00:00Z"
updated_at: "2026-03-26T00:00:00Z"
---
`;
    writeFileSync(join(graphDir, "wg-comp1--test.md"), compMd);
    writeIssue(whygraphDir, "wg-comp1", [{ field: "parent", message: "missing parent" }]);

    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(true);

    // Mock prompts to select a feature
    vi.mocked(prompts).mockResolvedValue({ featureId: "wg-feat1" });

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    expect(vi.mocked(prompts)).toHaveBeenCalled();
  });

  it("outputs message when server not running for CLI-resolvable issues", async () => {
    const { whygraphDir } = setupProject(tempDir);
    writeIssue(whygraphDir, "wg-d020", [{ field: "tags", message: 'invalid tag "x"' }]);

    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(false);

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("whygraph up");
  });

  it("prompts to resolve date issue when server is running", async () => {
    const { whygraphDir, graphDir } = setupProject(tempDir);
    writeDecisionFile(graphDir, "wg-d040");
    writeIssue(whygraphDir, "wg-d040", [{ field: "date", message: "invalid date" }]);

    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(true);

    vi.mocked(prompts).mockResolvedValue({ date: "2026-03-26" });

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    expect(vi.mocked(prompts)).toHaveBeenCalled();
  });

  it("prompts to resolve affects issue when server is running", async () => {
    const { whygraphDir, graphDir } = setupProject(tempDir);
    writeFeatureFile(graphDir, "wg-feat10", "AuthFeature");
    writeDecisionFile(graphDir, "wg-d050");
    writeIssue(whygraphDir, "wg-d050", [{ field: "affects", message: 'affects ref "wg-missing"' }]);

    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(true);

    // Mock prompts: action=remove to remove the invalid ref
    vi.mocked(prompts).mockResolvedValue({ action: "remove" });

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    expect(vi.mocked(prompts)).toHaveBeenCalled();
  });

  it("clears issue when entity no longer exists on disk", async () => {
    const { whygraphDir } = setupProject(tempDir);
    // Write issue for entity that doesn't exist in graph
    writeIssue(whygraphDir, "wg-gone", [{ field: "tags", message: "invalid tag" }]);

    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(true);

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("no longer exists");
  });

  it("handles user cancellation gracefully", async () => {
    const { whygraphDir, graphDir } = setupProject(tempDir);
    writeDecisionFile(graphDir, "wg-d030");
    writeIssue(whygraphDir, "wg-d030", [{ field: "tags", message: 'invalid tag "bad"' }]);

    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(true);

    // Simulate user cancellation by throwing UserCancelled
    vi.mocked(prompts).mockImplementation(
      async (_questions: unknown, options: { onCancel?: () => void } = {}) => {
        if (options?.onCancel) options.onCancel();
        return {};
      },
    );

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("Cancelled");
  });

  it("deletes entity when affects has single invalid ref and action=delete", async () => {
    const { whygraphDir, graphDir } = setupProject(tempDir);
    // Decision with exactly ONE affects ref (the invalid one)
    const md = `---
id: wg-d060
label: Decision
title: Test Decision
status: active
date: "2026-03-24"
affects:
  - wg-missing
tags:
  - arch
created_at: "2026-03-26T00:00:00Z"
updated_at: "2026-03-26T00:00:00Z"
---

## Context
ctx

## Decision
dec

## Tradeoffs
trd

## Alternatives
none
`;
    writeFileSync(join(graphDir, "wg-d060--test.md"), md);
    writeIssue(whygraphDir, "wg-d060", [{ field: "affects", message: 'affects ref "wg-missing"' }]);

    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(true);

    vi.mocked(prompts).mockResolvedValue({ action: "delete" });

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("Deleted");
  });

  it("replaces invalid affects ref when action=replace", async () => {
    const { whygraphDir, graphDir } = setupProject(tempDir);
    writeFeatureFile(graphDir, "wg-feat20", "AaaFeature");
    writeFeatureFile(graphDir, "wg-feat21", "ZzzFeature");
    // Decision with multiple affects so "remove" appears (not "delete")
    const md = `---
id: wg-d070
label: Decision
title: Test Decision
status: active
date: "2026-03-24"
affects:
  - wg-missing
  - wg-feat20
tags:
  - arch
created_at: "2026-03-26T00:00:00Z"
updated_at: "2026-03-26T00:00:00Z"
---

## Context
ctx

## Decision
dec

## Tradeoffs
trd

## Alternatives
none
`;
    writeFileSync(join(graphDir, "wg-d070--test.md"), md);
    writeIssue(whygraphDir, "wg-d070", [{ field: "affects", message: 'affects ref "wg-missing"' }]);

    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(true);

    // First call: choose replace; second call: pick replacement id
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: "replace" })
      .mockResolvedValueOnce({ id: "wg-feat20" });

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    expect(vi.mocked(prompts)).toHaveBeenCalledTimes(2);
  });

  it("reports cannot assign parent when no features exist in graph", async () => {
    const { whygraphDir, graphDir } = setupProject(tempDir);
    // Component with missing parent but NO features in the graph
    const compMd = `---
id: wg-comp40
label: Component
name: OrphanComp
status: active
created_at: "2026-03-26T00:00:00Z"
updated_at: "2026-03-26T00:00:00Z"
---
`;
    writeFileSync(join(graphDir, "wg-comp40--test.md"), compMd);
    writeIssue(whygraphDir, "wg-comp40", [{ field: "parent", message: "missing parent" }]);

    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(true);

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("No features found");
  });

  it("shows description when component has one", async () => {
    const { whygraphDir, graphDir } = setupProject(tempDir);
    writeFeatureFile(graphDir, "wg-feat50", "DescFeature");
    const compMd = `---
id: wg-comp50
label: Component
name: DescComp
status: active
description: A component with a description
created_at: "2026-03-26T00:00:00Z"
updated_at: "2026-03-26T00:00:00Z"
---
`;
    writeFileSync(join(graphDir, "wg-comp50--test.md"), compMd);
    writeIssue(whygraphDir, "wg-comp50", [{ field: "parent", message: "missing parent" }]);

    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(true);

    vi.mocked(prompts).mockResolvedValue({ featureId: "wg-feat50" });

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("A component with a description");
  });

  it("uses entityId.md path in agent prompt when no matching file in graph", async () => {
    const { whygraphDir } = setupProject(tempDir);
    // Write issue for wg-ghost — no .md file in graph for this id
    writeIssue(whygraphDir, "wg-ghost", [{ field: "context", message: "missing context" }]);

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("wg-ghost.md");
  });

  it("drills down to component when feature has existing components", async () => {
    const { whygraphDir, graphDir } = setupProject(tempDir);
    writeFeatureFile(graphDir, "wg-feat30", "TopFeature");

    // Write TWO existing components under wg-feat30 (triggers sort comparator)
    const existingComp = `---
id: wg-comp30
label: Component
name: AlphaComp
status: active
parent: wg-feat30
created_at: "2026-03-26T00:00:00Z"
updated_at: "2026-03-26T00:00:00Z"
---
`;
    writeFileSync(join(graphDir, "wg-comp30--test.md"), existingComp);

    const existingComp2 = `---
id: wg-comp32
label: Component
name: ZetaComp
status: active
parent: wg-feat30
created_at: "2026-03-26T00:00:00Z"
updated_at: "2026-03-26T00:00:00Z"
---
`;
    writeFileSync(join(graphDir, "wg-comp32--test.md"), existingComp2);

    // New component with missing parent and refs (covers entity.refs display path)
    const newComp = `---
id: wg-comp31
label: Component
name: NewComp
status: active
refs:
  - file: src/new-comp.ts
created_at: "2026-03-26T00:00:00Z"
updated_at: "2026-03-26T00:00:00Z"
---
`;
    writeFileSync(join(graphDir, "wg-comp31--test.md"), newComp);
    writeIssue(whygraphDir, "wg-comp31", [{ field: "parent", message: "missing parent" }]);

    const serverUtils = await import("../../src/cli/commands/server-utils.js");
    vi.spyOn(serverUtils, "isServerRunning").mockReturnValue(true);

    // First: select feature; Second: drilldown — attach to existing component
    vi.mocked(prompts)
      .mockResolvedValueOnce({ featureId: "wg-feat30" })
      .mockResolvedValueOnce({ parentId: "wg-comp30" });

    const { registerIssuesCommand } = await import("../../src/cli/commands/issues.js");
    const program = new Command();
    registerIssuesCommand(program);
    await program.parseAsync(["node", "whygraph", "issues"]);

    expect(vi.mocked(prompts)).toHaveBeenCalledTimes(2);
  });
});
