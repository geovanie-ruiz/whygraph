import { join } from "node:path";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import type { Command } from "commander";
import prompts from "prompts";
import { listIssues } from "../../entity/issues.js";
import type { EntityIssue } from "../../entity/issues.js";
import { parseEntity } from "../../entity/parser.js";
import { writeEntity } from "../../entity/writer.js";
import { DECISION_TAGS } from "../../entity/types.js";
import type { Entity, DecisionNode, StructuralNode } from "../../entity/types.js";
import { isDecisionNode, isStructuralNode } from "../../entity/types.js";
import { findWhygraphDir, getConfiguredPort, isServerRunning } from "./server-utils.js";

class UserCancelled extends Error {
  constructor() { super("cancelled"); }
}

const onCancel = () => { throw new UserCancelled(); };

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

function loadEntitiesFromDisk(graphDir: string): Map<string, Entity> {
  const entities = new Map<string, Entity>();
  let files: string[];
  try {
    files = readdirSync(graphDir).filter((f) => f.endsWith(".md"));
  } catch {
    return entities;
  }
  for (const file of files) {
    try {
      const content = readFileSync(join(graphDir, file), "utf-8");
      const entity = parseEntity(content);
      if (entity) entities.set(entity.id, entity);
    } catch { /* skip */ }
  }
  return entities;
}

function generateAgentPrompt(issue: EntityIssue, graphDir: string): string {
  const files = readdirSync(graphDir).filter((f) => f.startsWith(issue.entityId));
  const filePath = files.length > 0
    ? `.whygraph/graph/${files[0]}`
    : `.whygraph/graph/${issue.entityId}.md`;

  const missingFields = issue.errors.map((e) => e.field).join(", ");

  return (
    `Review ${issue.entityId} in ${filePath}. ` +
    `It has validation issues: missing ${missingFields}. ` +
    `Read the existing decision content and the surrounding codebase, ` +
    `then fill in the missing sections.`
  );
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

async function resolveParentInteractively(
  entity: StructuralNode,
  entities: Map<string, Entity>,
  graphDir: string,
): Promise<boolean> {
  const features = Array.from(entities.values())
    .filter((e) => isStructuralNode(e) && e.label === "Feature")
    .sort((a, b) => (a as StructuralNode).name.localeCompare((b as StructuralNode).name));

  if (features.length === 0) {
    process.stdout.write("  No features found in the graph. Cannot assign parent.\n");
    return false;
  }

  // Show context so the developer knows what this node is
  process.stdout.write(`\n  ${entity.label}: ${entity.name} (${entity.id})\n`);
  if (entity.description) {
    process.stdout.write(`  ${entity.description}\n`);
  }
  if (entity.refs && entity.refs.length > 0) {
    process.stdout.write(`  Files: ${entity.refs.map((r) => r.file).join(", ")}\n`);
  }
  process.stdout.write("\n");

  const featureResponse = await prompts({
    type: "select",
    name: "featureId",
    message: `Which feature does "${entity.name}" belong to?`,
    choices: features.map((f) => ({
      title: `${(f as StructuralNode).name} (${f.id})`,
      value: f.id,
    })),
  }, { onCancel });

  if (!featureResponse.featureId) return false;

  const components = Array.from(entities.values())
    .filter((e) => isStructuralNode(e) && e.label === "Component" && e.parent === featureResponse.featureId)
    .sort((a, b) => (a as StructuralNode).name.localeCompare((b as StructuralNode).name));

  if (components.length > 0 && entity.label === "Component") {
    const drillDown = await prompts({
      type: "select",
      name: "parentId",
      message: "Attach to the feature, or nest under a component?",
      choices: [
        { title: `Attach to ${(entities.get(featureResponse.featureId) as StructuralNode).name}`, value: featureResponse.featureId },
        ...components.map((c) => ({
          title: `Under ${(c as StructuralNode).name} (${c.id})`,
          value: c.id,
        })),
      ],
    }, { onCancel });

    if (!drillDown.parentId) return false;
    entity.parent = drillDown.parentId;
  } else {
    entity.parent = featureResponse.featureId;
  }

  entity.updated_at = new Date().toISOString();
  writeEntity(graphDir, entity);
  process.stdout.write(`  Updated ${entity.id}: parent set to ${entity.parent}\n\n`);
  return true;
}

function printDecisionContext(entity: DecisionNode): void {
  process.stdout.write(`\n  Decision: ${entity.title} (${entity.id})\n`);
  if (entity.context) {
    const preview = entity.context.length > 120 ? entity.context.slice(0, 120) + "..." : entity.context;
    process.stdout.write(`  Context: ${preview}\n`);
  }
  if (entity.affects.length > 0) {
    process.stdout.write(`  Affects: ${entity.affects.join(", ")}\n`);
  }
  process.stdout.write("\n");
}

async function resolveDateInteractively(
  entity: DecisionNode,
  graphDir: string,
): Promise<boolean> {
  printDecisionContext(entity);

  const response = await prompts({
    type: "text",
    name: "date",
    message: `Invalid date "${entity.date}". Enter corrected date (YYYY-MM-DD):`,
    validate: (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) || "Must be YYYY-MM-DD",
  }, { onCancel });

  if (!response.date) return false;

  entity.date = response.date;
  entity.updated_at = new Date().toISOString();
  writeEntity(graphDir, entity);
  process.stdout.write(`  Updated ${entity.id}: date set to ${entity.date}\n\n`);
  return true;
}

async function resolveTagInteractively(
  entity: DecisionNode,
  badTag: string,
  graphDir: string,
): Promise<boolean> {
  printDecisionContext(entity);

  const response = await prompts({
    type: "select",
    name: "tag",
    message: `Invalid tag "${badTag}". Pick a replacement:`,
    choices: DECISION_TAGS.map((t) => ({ title: t, value: t })),
  }, { onCancel });

  if (!response.tag) return false;

  entity.tags = entity.tags.map((t) => (t === badTag ? response.tag : t)) as typeof entity.tags;
  entity.updated_at = new Date().toISOString();
  writeEntity(graphDir, entity);
  process.stdout.write(`  Updated ${entity.id}: tag "${badTag}" replaced with "${response.tag}"\n\n`);
  return true;
}

async function resolveIssueInteractively(
  issue: EntityIssue,
  entities: Map<string, Entity>,
  graphDir: string,
): Promise<void> {
  const entity = entities.get(issue.entityId);
  if (!entity) {
    process.stdout.write(`  Entity ${issue.entityId} not found on disk. Skipping.\n\n`);
    return;
  }

  for (const err of issue.errors) {
    if (err.field === "parent" && isStructuralNode(entity)) {
      await resolveParentInteractively(entity, entities, graphDir);
    } else if (err.field === "date" && isDecisionNode(entity)) {
      await resolveDateInteractively(entity, graphDir);
    } else if (err.field === "tags" && isDecisionNode(entity)) {
      const match = err.message.match(/invalid tag "([^"]+)"/);
      if (match) {
        await resolveTagInteractively(entity, match[1], graphDir);
      }
    }
  }
}

export function registerIssuesCommand(program: Command): void {
  program
    .command("issues")
    .description("List and resolve entity validation issues")
    .option("--json", "Output results as JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        const result = runIssues(process.cwd());

        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
          return;
        }

        if (result.total === 0) {
          process.stdout.write("No issues found.\n");
          return;
        }

        const parts: string[] = [];
        if (result.agentNeeded > 0) parts.push(`${result.agentNeeded} need an agent`);
        if (result.cliResolvable > 0) parts.push(`${result.cliResolvable} resolvable now`);

        process.stdout.write(`${result.total} issue(s): ${parts.join(", ")}\n\n`);

        const projectDir = findWhygraphDir(process.cwd())!;
        const graphDir = join(projectDir, ".whygraph", "graph");

        // Agent-needed issues: inline if < 3, MD file if >= 3
        const agentIssues = result.issues.filter((i) => !isCliResolvable(i));
        if (agentIssues.length > 0) {
          if (agentIssues.length < 3) {
            process.stdout.write("--- Agent-needed issues ---\n\n");
            for (const issue of agentIssues) {
              process.stdout.write(`${issue.entityId}:\n`);
              for (const err of issue.errors) {
                const prefix = err.severity === "error" ? "  ERROR" : "  WARN ";
                process.stdout.write(`${prefix} ${err.field}: ${err.message}\n`);
              }
              process.stdout.write(`  Prompt: ${generateAgentPrompt(issue, graphDir)}\n\n`);
            }
          } else {
            const mdLines: string[] = [
              "# Whygraph Agent Issues",
              "",
              `${agentIssues.length} entities need an agent to resolve validation issues.`,
              "For each entity below, read the decision file, understand the context",
              "from the codebase, and fill in the missing sections.",
              "",
            ];
            for (const issue of agentIssues) {
              mdLines.push(`## ${issue.entityId}`);
              mdLines.push("");
              for (const err of issue.errors) {
                mdLines.push(`- **${err.field}**: ${err.message}`);
              }
              mdLines.push("");
              mdLines.push(`**Prompt:** ${generateAgentPrompt(issue, graphDir)}`);
              mdLines.push("");
            }

            const mdPath = join(projectDir, ".whygraph", "AGENT_ISSUES.md");
            writeFileSync(mdPath, mdLines.join("\n"), "utf-8");
            process.stdout.write(
              `${agentIssues.length} agent-needed issues written to .whygraph/AGENT_ISSUES.md\n` +
              `Prompt your agent: "Read .whygraph/AGENT_ISSUES.md and resolve each issue."\n\n`,
            );
          }
        }

        // Walk through CLI-resolvable issues interactively
        const cliIssues = result.issues.filter((i) => isCliResolvable(i));
        if (cliIssues.length > 0) {
          process.stdout.write("--- Resolvable issues ---\n\n");

          const entities = loadEntitiesFromDisk(graphDir);

          for (const issue of cliIssues) {
            await resolveIssueInteractively(issue, entities, graphDir);
          }
        }
      } catch (err: unknown) {
        if (err instanceof UserCancelled) {
          process.stdout.write("\nCancelled.\n");
          return;
        }
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
