import { join } from "node:path";
import { readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import type { Command } from "commander";
import prompts from "prompts";
import { listIssues, deleteIssue } from "../../entity/issues.js";
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

async function resolveAffectsInteractively(
  entity: DecisionNode,
  invalidRefs: string[],
  entities: Map<string, Entity>,
  graphDir: string,
): Promise<boolean> {
  printDecisionContext(entity);

  const validChoices = (Array.from(entities.values()).filter((e) => !isDecisionNode(e)) as StructuralNode[])
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => ({ title: `${e.name} (${e.id})`, value: e.id }));

  let anyResolved = false;
  for (const ref of invalidRefs) {
    const isLastRef = entity.affects.length === 1;
    const choices = isLastRef
      ? [{ title: "Remove ref and delete node", value: "delete" }, { title: "Replace it", value: "replace" }]
      : [{ title: "Remove it", value: "remove" }, { title: "Replace it", value: "replace" }];

    const response = await prompts({
      type: "select",
      name: "action",
      message: `Invalid affects ref "${ref}". What do you want to do?`,
      choices,
    }, { onCancel });

    if (response.action === "delete") {
      const files = readdirSync(graphDir).filter((f) => f.startsWith(entity.id));
      if (files.length > 0) unlinkSync(join(graphDir, files[0]));
      const whygraphDir = join(graphDir, "..");
      deleteIssue(whygraphDir, entity.id);
      process.stdout.write(`  Deleted ${entity.id}\n\n`);
      return true;
    } else if (response.action === "remove") {
      entity.affects = entity.affects.filter((a) => a !== ref);
      anyResolved = true;
    } else if (response.action === "replace") {
      const replacement = await prompts({
        type: "select",
        name: "id",
        message: `Replace "${ref}" with:`,
        choices: validChoices,
      }, { onCancel });
      if (replacement.id) {
        entity.affects = entity.affects.map((a) => (a === ref ? replacement.id : a));
        anyResolved = true;
      }
    }
  }

  if (anyResolved) {
    entity.updated_at = new Date().toISOString();
    writeEntity(graphDir, entity);
    process.stdout.write(`  Updated ${entity.id}: affects refs resolved\n\n`);
  }

  return anyResolved;
}

async function resolveIssueInteractively(
  issue: EntityIssue,
  entities: Map<string, Entity>,
  graphDir: string,
): Promise<boolean> {
  const entity = entities.get(issue.entityId);
  if (!entity) {
    const whygraphDir = join(graphDir, "..");
    deleteIssue(whygraphDir, issue.entityId);
    process.stdout.write(`  Entity ${issue.entityId} no longer exists — issue cleared.\n\n`);
    return true;
  }

  let resolved = false;
  for (const err of issue.errors) {
    if (err.field === "parent" && isStructuralNode(entity)) {
      if (await resolveParentInteractively(entity, entities, graphDir)) resolved = true;
    } else if (err.field === "date" && isDecisionNode(entity)) {
      if (await resolveDateInteractively(entity, graphDir)) resolved = true;
    } else if (err.field === "tags" && isDecisionNode(entity)) {
      const match = err.message.match(/invalid tag "([^"]+)"/);
      if (match) {
        if (await resolveTagInteractively(entity, match[1], graphDir)) resolved = true;
      }
    } else if (err.field === "affects" && isDecisionNode(entity)) {
      const invalidRefs = issue.errors
        .filter((e) => e.field === "affects")
        .map((e) => e.message.match(/affects ref "([^"]+)"/)?.[1])
        .filter((r): r is string => r !== undefined);
      if (invalidRefs.length > 0) {
        if (await resolveAffectsInteractively(entity, invalidRefs, entities, graphDir)) resolved = true;
      }
      break; // all affects errors handled in one pass
    }
  }

  return resolved;
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
            for (const issue of agentIssues) {
              process.stdout.write(`[AGENT] ${generateAgentPrompt(issue, graphDir)}\n\n`);
            }
          } else {
            // Group by missing fields to avoid repeating instructions
            const byFields = new Map<string, string[]>();
            for (const issue of agentIssues) {
              const files = readdirSync(graphDir).filter((f) => f.startsWith(issue.entityId));
              const filePath = files.length > 0 ? `.whygraph/graph/${files[0]}` : `.whygraph/graph/${issue.entityId}.md`;
              const key = issue.errors.map((e) => e.field).sort().join(", ");
              if (!byFields.has(key)) byFields.set(key, []);
              byFields.get(key)!.push(filePath);
            }

            const mdLines: string[] = [
              `For each decision file below, read its existing content and write meaningful content for the missing sections.`,
              `Base your additions on the context, decision, and tradeoffs already written.`,
              `Do not write placeholder text like "None considered." or "N/A."`,
              `The file watcher will automatically clear each issue once the missing sections are present.`,
              "",
            ];
            for (const [fields, files] of byFields) {
              mdLines.push(`Missing: ${fields}`);
              for (const f of files) {
                mdLines.push(`- ${f}`);
              }
              mdLines.push("");
            }

            const mdPath = join(projectDir, ".whygraph", "AGENT_ISSUES.md");
            writeFileSync(mdPath, mdLines.join("\n"), "utf-8");
            process.stdout.write(
              `${agentIssues.length} agent issues written to .whygraph/AGENT_ISSUES.md\n` +
              `Prompt: "Read .whygraph/AGENT_ISSUES.md and resolve each issue."\n\n`,
            );
          }
        }

        // Walk through CLI-resolvable issues interactively
        const cliIssues = result.issues.filter((i) => isCliResolvable(i));
        if (cliIssues.length > 0) {
          const port = getConfiguredPort(projectDir);
          if (!isServerRunning(port)) {
            process.stdout.write(
              `${cliIssues.length} resolvable issue(s) found.\n` +
              `Run 'whygraph up' first so resolved issues are properly reconciled.\n`,
            );
            return;
          }

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
