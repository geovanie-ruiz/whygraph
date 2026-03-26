import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runValidate } from "../../src/cli/commands/validate.js";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-test-"));
}

function writeEntityFile(dir: string, filename: string, content: string): void {
  const graphDir = join(dir, ".whygraph", "graph");
  mkdirSync(graphDir, { recursive: true });
  writeFileSync(join(graphDir, filename), content, "utf-8");
}

const VALID_APP = `---
id: wg-app1
label: App
name: MyApp
status: active
created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---
The root application.
`;

const VALID_STRUCTURAL = `---
id: wg-a1b2
label: Feature
name: Authentication
status: active
parent: wg-app1
created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---
Handles user authentication.
`;

const INVALID_STRUCTURAL_MISSING_NAME = `---
id: wg-a1b2
label: Feature
status: active
parent: wg-app1
created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---
`;

const UNPARSEABLE = `this is not valid frontmatter at all
just random text with no yaml
`;

const VALID_DECISION = `---
id: wg-c3d4
label: Decision
title: Use WebSockets
status: active
date: "2026-03-24"
affects:
  - wg-a1b2
tags:
  - arch
created_at: "2026-03-24T10:00:00Z"
updated_at: "2026-03-24T10:00:00Z"
---

## Context

Need real-time updates.

## Decision

Use WebSocket subscriptions.

## Tradeoffs

Gained: real-time. Lost: complexity.

## Alternatives

Polling — rejected: latency.
`;

describe("runValidate", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns zero errors for an empty directory", async () => {
    mkdirSync(join(tempDir, ".whygraph", "graph"), { recursive: true });
    const result = await runValidate(tempDir);
    expect(result.filesChecked).toBe(0);
    expect(result.entitiesParsed).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("returns no errors for a valid entity file", async () => {
    writeEntityFile(tempDir, "app.md", VALID_APP);
    const result = await runValidate(tempDir);
    expect(result.filesChecked).toBe(1);
    expect(result.entitiesParsed).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("returns errors with file path for an invalid entity", async () => {
    writeEntityFile(tempDir, "bad.md", INVALID_STRUCTURAL_MISSING_NAME);
    const result = await runValidate(tempDir);
    expect(result.filesChecked).toBe(1);
    expect(result.entitiesParsed).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].file).toContain("bad.md");
  });

  it("reports unparseable files as errors", async () => {
    writeEntityFile(tempDir, "garbage.md", UNPARSEABLE);
    const result = await runValidate(tempDir);
    expect(result.filesChecked).toBe(1);
    expect(result.entitiesParsed).toBe(0);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].file).toContain("garbage.md");
    expect(result.errors[0].message).toMatch(/parse/i);
  });

  it("handles multiple files with mixed validity", async () => {
    writeEntityFile(tempDir, "good.md", VALID_STRUCTURAL);
    writeEntityFile(tempDir, "bad.md", UNPARSEABLE);
    writeEntityFile(tempDir, "decision.md", VALID_DECISION);
    const result = await runValidate(tempDir);
    expect(result.filesChecked).toBe(3);
    expect(result.entitiesParsed).toBe(2);
    // At minimum the unparseable file generates an error; cross-ref warnings may also appear
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors.some((e) => e.file.includes("bad.md"))).toBe(true);
  });

  it("returns structured ValidateResult for --json consumption", async () => {
    writeEntityFile(tempDir, "good.md", VALID_STRUCTURAL);
    const result = await runValidate(tempDir);
    expect(result).toHaveProperty("filesChecked");
    expect(result).toHaveProperty("entitiesParsed");
    expect(result).toHaveProperty("errors");
    expect(typeof result.filesChecked).toBe("number");
    expect(typeof result.entitiesParsed).toBe("number");
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it("reports validation errors from validateEntity with details", async () => {
    // A file that parses but has validation errors (bad created_at format)
    const badTimestamp = `---
id: wg-x1y2
label: Feature
name: BadTimestamp
status: active
parent: wg-app1
created_at: "not-a-timestamp"
updated_at: "2026-03-24T00:00:00Z"
---
`;
    writeEntityFile(tempDir, "badts.md", badTimestamp);
    const result = await runValidate(tempDir);
    expect(result.filesChecked).toBe(1);
    expect(result.entitiesParsed).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].file).toContain("badts.md");
    expect(result.errors[0].field).toBe("created_at");
  });
});
