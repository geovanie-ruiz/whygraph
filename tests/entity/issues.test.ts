import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeIssue, readIssue, deleteIssue, listIssues, reconcileIssue } from "../../src/entity/issues.js";
import type { ValidationError } from "../../src/entity/validate.js";

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "whygraph-issues-test-"));
}

const SAMPLE_ERRORS: ValidationError[] = [
  { field: "affects", message: "affects is required", severity: "error" },
  { field: "tags", message: "invalid tag \"foo\"", severity: "error" },
];

const WARNING_ONLY: ValidationError[] = [
  { field: "parent", message: "Feature nodes should have a parent", severity: "warning" },
];

describe("issue sidecars", () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writeIssue creates a JSON sidecar", () => {
    const issue = writeIssue(dir, "wg-d001", SAMPLE_ERRORS);

    expect(issue.entityId).toBe("wg-d001");
    expect(issue.errors).toEqual(SAMPLE_ERRORS);
    expect(existsSync(join(dir, "issues", "wg-d001.json"))).toBe(true);
  });

  it("readIssue returns null for non-existent issue", () => {
    expect(readIssue(dir, "wg-none")).toBeNull();
  });

  it("readIssue returns written issue", () => {
    writeIssue(dir, "wg-d001", SAMPLE_ERRORS);
    const issue = readIssue(dir, "wg-d001");

    expect(issue).not.toBeNull();
    expect(issue!.entityId).toBe("wg-d001");
    expect(issue!.errors).toHaveLength(2);
  });

  it("deleteIssue removes the sidecar", () => {
    writeIssue(dir, "wg-d001", SAMPLE_ERRORS);
    expect(deleteIssue(dir, "wg-d001")).toBe(true);
    expect(readIssue(dir, "wg-d001")).toBeNull();
  });

  it("deleteIssue returns false for non-existent issue", () => {
    expect(deleteIssue(dir, "wg-none")).toBe(false);
  });

  it("listIssues returns all issues", () => {
    writeIssue(dir, "wg-d001", SAMPLE_ERRORS);
    writeIssue(dir, "wg-d002", WARNING_ONLY);

    const issues = listIssues(dir);
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.entityId).sort()).toEqual(["wg-d001", "wg-d002"]);
  });

  it("listIssues returns empty array when no issues dir", () => {
    expect(listIssues(dir)).toEqual([]);
  });

  it("reconcileIssue creates sidecar for errors", () => {
    const result = reconcileIssue(dir, "wg-d001", SAMPLE_ERRORS);
    expect(result).not.toBeNull();
    expect(readIssue(dir, "wg-d001")).not.toBeNull();
  });

  it("reconcileIssue creates sidecar for warnings", () => {
    const result = reconcileIssue(dir, "wg-feat1", WARNING_ONLY);
    expect(result).not.toBeNull();
  });

  it("reconcileIssue deletes sidecar when no errors", () => {
    writeIssue(dir, "wg-d001", SAMPLE_ERRORS);
    const result = reconcileIssue(dir, "wg-d001", []);
    expect(result).toBeNull();
    expect(readIssue(dir, "wg-d001")).toBeNull();
  });

  it("writeIssue preserves createdAt on update", () => {
    const first = writeIssue(dir, "wg-d001", SAMPLE_ERRORS);
    const second = writeIssue(dir, "wg-d001", WARNING_ONLY);

    expect(second.createdAt).toBe(first.createdAt);
    expect(second.errors).toEqual(WARNING_ONLY);
  });
});
