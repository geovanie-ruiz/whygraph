import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import yaml from "js-yaml";
import type { WhygraphConfig } from "../../entity/types.js";
import { parseEntity } from "../../entity/parser.js";
import { findWhygraphDir } from "./serve.js";

// ============================================================
// Types
// ============================================================

export interface OnboardResult {
  appId: string;
  appName: string;
  prefix: string;
  prompt: string;
}

// ============================================================
// Core Logic
// ============================================================

export function runOnboard(targetDir: string): OnboardResult {
  const projectDir = findWhygraphDir(targetDir);
  if (!projectDir) {
    throw new Error(`.whygraph/ not found. Run "npx whygraph init" first.`);
  }

  const configPath = join(projectDir, ".whygraph", "config.yaml");
  if (!existsSync(configPath)) {
    throw new Error(`.whygraph/config.yaml not found. Run "npx whygraph init" first.`);
  }

  const raw = readFileSync(configPath, "utf-8");
  const config = yaml.load(raw) as WhygraphConfig;

  // Find the App node
  const graphDir = join(projectDir, ".whygraph", "graph");
  let appId = "";
  let appName = config.appName;

  if (existsSync(graphDir)) {
    const files = readdirSync(graphDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const content = readFileSync(join(graphDir, file), "utf-8");
      const entity = parseEntity(content);
      if (entity !== null && entity.label === "App") {
        appId = entity.id;
        /* v8 ignore next 1 */
        if ("name" in entity) appName = entity.name;
        break;
      }
    }
  }

  if (!appId) {
    throw new Error(`No App node found in .whygraph/graph/. Run "npx whygraph init" first.`);
  }

  const prompt = buildOnboardingPrompt(appName, appId, config.prefix);

  return { appId, appName, prefix: config.prefix, prompt };
}

function buildOnboardingPrompt(appName: string, appId: string, prefix: string): string {
  return [
    `I'm using whygraph to maintain a living decision graph for ${appName}.`,
    `The root App node is \`${appId}\`.`,
    ``,
    `Please explore this codebase and build out the structural graph by:`,
    ``,
    `1. Identifying the top-level features or modules (e.g. authentication, data pipeline, API layer, UI pages).`,
    `   For each one, create a Feature node using the whygraph MCP tool \`whygraph_create_node\`:`,
    `   - label: Feature`,
    `   - parent: ${appId}`,
    `   - name: <feature name>`,
    `   - status: active`,
    ``,
    `2. For each Feature, identify its key components (e.g. services, hooks, controllers, presenters).`,
    `   For each one, create a Component node:`,
    `   - label: Component`,
    `   - parent: <feature id>`,
    `   - name: <component name>`,
    `   - status: active`,
    ``,
    `3. Use the \`refs\` field to link nodes to their source files where relevant.`,
    ``,
    `4. After building the structural graph, review the existing decisions in .whygraph/graph/ and`,
    `   update their \`affects\` fields to link them to the relevant Feature or Component nodes you created.`,
    ``,
    `Node IDs should use the prefix \`${prefix}\` followed by a 4-character nanoid (e.g. \`${prefix}abcd\`).`,
    ``,
    `Start by listing the top-level directories and key entry points, then propose the Feature list`,
    `before creating any nodes. I'll confirm before you proceed.`,
  ].join("\n");
}

// ============================================================
// CLI Wiring
// ============================================================

export function registerOnboardCommand(program: Command): void {
  program
    .command("onboard")
    .description("Print a codebase analysis prompt to bootstrap your whygraph graph")
    .option("--json", "Output results as JSON")
    .action((opts: { json?: boolean }) => {
      try {
        const result = runOnboard(process.cwd());

        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } else {
          process.stdout.write(
            `Paste the following prompt into your AI agent:\n\n` +
            `${"─".repeat(60)}\n` +
            `${result.prompt}\n` +
            `${"─".repeat(60)}\n`,
          );
        }
      } catch (err: unknown) {
        /* v8 ignore next 1 */
        const message = err instanceof Error ? err.message : String(err);
        if (opts.json) {
          process.stdout.write(
            JSON.stringify({ error: message }, null, 2) + "\n",
          );
        } else {
          process.stderr.write(`Error: ${message}\n`);
        }
        process.exitCode = 1;
      }
    });
}
