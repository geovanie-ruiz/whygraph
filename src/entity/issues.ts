import { writeFileSync, readFileSync, readdirSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ValidationError } from "./validate.js";

export interface EntityIssue {
  entityId: string;
  errors: ValidationError[];
  createdAt: string;
  updatedAt: string;
}

function issuesDir(whygraphDir: string): string {
  return join(whygraphDir, "issues");
}

function issueFilePath(whygraphDir: string, entityId: string): string {
  return join(issuesDir(whygraphDir), `${entityId}.json`);
}

export function writeIssue(whygraphDir: string, entityId: string, errors: ValidationError[]): EntityIssue {
  const dir = issuesDir(whygraphDir);
  mkdirSync(dir, { recursive: true });

  const now = new Date().toISOString();
  const existing = readIssue(whygraphDir, entityId);

  const issue: EntityIssue = {
    entityId,
    errors,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  writeFileSync(issueFilePath(whygraphDir, entityId), JSON.stringify(issue, null, 2) + "\n", "utf-8");
  return issue;
}

export function readIssue(whygraphDir: string, entityId: string): EntityIssue | null {
  const filePath = issueFilePath(whygraphDir, entityId);
  if (!existsSync(filePath)) return null;

  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as EntityIssue;
  } catch {
    /* v8 ignore next 1 */
    return null;
  }
}

export function deleteIssue(whygraphDir: string, entityId: string): boolean {
  const filePath = issueFilePath(whygraphDir, entityId);
  if (!existsSync(filePath)) return false;

  unlinkSync(filePath);
  return true;
}

export function listIssues(whygraphDir: string): EntityIssue[] {
  const dir = issuesDir(whygraphDir);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const issues: EntityIssue[] = [];

  for (const file of files) {
    try {
      const raw = readFileSync(join(dir, file), "utf-8");
      issues.push(JSON.parse(raw) as EntityIssue);
    } catch {
      // Skip corrupted issue files
    }
  }

  return issues;
}

export function reconcileIssue(
  whygraphDir: string,
  entityId: string,
  errors: ValidationError[],
): EntityIssue | null {
  const hasErrors = errors.some((e) => e.severity === "error");
  const hasWarnings = errors.length > 0;

  if (hasErrors || hasWarnings) {
    return writeIssue(whygraphDir, entityId, errors);
  }

  deleteIssue(whygraphDir, entityId);
  return null;
}
