import { join } from "node:path";
import type { Command } from "commander";
import { listIssues } from "../../entity/issues.js";
import type { EntityIssue } from "../../entity/issues.js";
import { findWhygraphDir } from "./server-utils.js";

export interface IssuesResult {
  agentNeeded: number;
  cliResolvable: number;
  total: number;
  issues: EntityIssue[];
}

const CLI_RESOLVABLE_FIELDS = new Set(["tags", "parent", "date", "affects", "supersedes"]);

function isCliResolvable(issue: EntityIssue): boolean {
  return issue.errors.length > 0 && issue.errors.every((e) => CLI_RESOLVABLE_FIELDS.has(e.field));
}

export function runIssues(targetDir: string): IssuesResult {
  const projectDir = findWhygraphDir(targetDir);
  if (!projectDir) {
    throw new Error(`.whygraph/ not found. Run "whygraph init" first.`);
  }

  const whygraphDir = join(projectDir, ".whygraph");
  const issues = listIssues(whygraphDir);
  let agentNeeded = 0;
  let cliResolvable = 0;

  for (const issue of issues) {
    if (isCliResolvable(issue)) {
      cliResolvable++;
    } else {
      agentNeeded++;
    }
  }

  return { agentNeeded, cliResolvable, total: issues.length, issues };
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
          if (result.total === 0) {
            process.stdout.write("No issues found.\n");
            return;
          }

          const parts: string[] = [];
          if (result.agentNeeded > 0) parts.push(`${result.agentNeeded} need an agent`);
          if (result.cliResolvable > 0) parts.push(`${result.cliResolvable} resolvable via whygraph issues`);

          process.stdout.write(`${result.total} issue(s): ${parts.join(", ")}\n\n`);

          for (const issue of result.issues) {
            const tag = isCliResolvable(issue) ? "[CLI]" : "[AGENT]";
            process.stdout.write(`${tag} ${issue.entityId}:\n`);
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
