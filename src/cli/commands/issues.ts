import { join } from "node:path";
import type { Command } from "commander";
import { listIssues } from "../../entity/issues.js";
import type { EntityIssue } from "../../entity/issues.js";
import { findWhygraphDir } from "./server-utils.js";

export interface IssuesResult {
  generalErrors: number;
  nodeErrors: number;
  resolvable: number;
  issues: EntityIssue[];
}

const RESOLVABLE_FIELDS = new Set(["alternatives", "context", "decision", "tradeoffs"]);

export function runIssues(targetDir: string): IssuesResult {
  const projectDir = findWhygraphDir(targetDir);
  if (!projectDir) {
    throw new Error(`.whygraph/ not found. Run "whygraph init" first.`);
  }

  const whygraphDir = join(projectDir, ".whygraph");
  const issues = listIssues(whygraphDir);
  let generalErrors = 0;
  let nodeErrors = 0;
  let resolvable = 0;

  for (const issue of issues) {
    const hasErrors = issue.errors.some((e) => e.severity === "error");
    if (hasErrors) {
      nodeErrors++;
    } else {
      generalErrors++;
    }

    const allResolvable = issue.errors.every((e) => RESOLVABLE_FIELDS.has(e.field));
    if (allResolvable && issue.errors.length > 0) {
      resolvable++;
    }
  }

  return { generalErrors, nodeErrors, resolvable, issues };
}

export function registerIssuesCommand(program: Command): void {
  program
    .command("issues")
    .description("List entity validation issues")
    .option("--json", "Output results as JSON")
    .action((opts: { json?: boolean }) => {
      try {
        const result = runIssues(process.cwd());

        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } else {
          if (result.issues.length === 0) {
            process.stdout.write("No issues found.\n");
            return;
          }

          process.stdout.write(
            `${result.nodeErrors} node-level error(s), ` +
            `${result.generalErrors} general warning(s), ` +
            `${result.resolvable} resolvable now\n\n`,
          );

          for (const issue of result.issues) {
            process.stdout.write(`${issue.entityId}:\n`);
            for (const err of issue.errors) {
              const prefix = err.severity === "error" ? "  ERROR" : "  WARN ";
              process.stdout.write(`${prefix} ${err.field}: ${err.message}\n`);
            }
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (opts.json) {
          process.stdout.write(JSON.stringify({ error: message }, null, 2) + "\n");
        } else {
          process.stderr.write(`Error: ${message}\n`);
        }
        process.exitCode = 1;
      }
    });
}
