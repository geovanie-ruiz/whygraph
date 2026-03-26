import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import yaml from "js-yaml";
import prompts from "prompts";
import { generateId } from "../../entity/id.js";
import { writeEntity } from "../../entity/writer.js";
import type {
  WhygraphConfig,
  Environment,
  StructuralNode,
} from "../../entity/types.js";
import { DECISION_TAGS } from "../../entity/types.js";
import { writePlatformRules } from "../../platform/rules.js";

// ============================================================
// Types
// ============================================================

export interface InitOptions {
  appName?: string;
  environment?: Environment;
  json?: boolean;
}

export interface InitResult {
  configPath: string;
  appNodePath: string;
  appId: string;
  platformRulesPath: string;
  mcpRegistered: boolean;
  mcpSetupPath?: string;
}

// ============================================================
// Core Logic
// ============================================================

export async function runInit(
  targetDir: string,
  options: InitOptions,
): Promise<InitResult> {
  const whygraphDir = join(targetDir, ".whygraph");

  if (existsSync(whygraphDir)) {
    throw new Error(
      `.whygraph/ already exists in ${targetDir}. Aborting init.`,
    );
  }

  // Resolve app name and environment from options or prompts
  let appName = options.appName;
  let environment = options.environment;

  if (!appName || !environment) {
    const answers = await prompts(
      [
        ...(appName
          ? []
          : [
              {
                type: "text" as const,
                name: "appName",
                message: "App name:",
              },
            ]),
        ...(environment
          ? []
          : [
              {
                type: "select" as const,
                name: "environment",
                message: "Environment:",
                choices: [
                  { title: "Claude Code", value: "claude-code" },
                  { title: "Cursor", value: "cursor" },
                  { title: "Copilot", value: "copilot" },
                  { title: "Other", value: "other" },
                ],
              },
            ]),
      ],
      { onCancel: () => { throw new Error("Init cancelled by user."); } },
    );

    if (!appName) appName = answers.appName;
    if (!environment) environment = answers.environment;
  }

  if (!appName) {
    throw new Error("App name is required.");
  }
  if (!environment) {
    throw new Error("Environment is required.");
  }

  // Create directory structure
  const graphDir = join(whygraphDir, "graph");
  mkdirSync(graphDir, { recursive: true });

  // Build config
  const config: WhygraphConfig = {
    appName,
    environment,
    prefix: "wg-",
    idLength: 4,
    tags: [...DECISION_TAGS],
    mcpMode: "default",
    serverPort: 4777,
  };

  // Write config.yaml
  const configPath = join(whygraphDir, "config.yaml");
  const configYaml = yaml.dump(config, { lineWidth: -1 });
  writeFileSync(configPath, configYaml, "utf-8");

  // Create App node
  const now = new Date().toISOString();
  const appId = generateId({ prefix: config.prefix, length: config.idLength });
  const appNode: StructuralNode = {
    id: appId,
    label: "App",
    name: appName,
    status: "active",
    created_at: now,
    updated_at: now,
  };

  const { filePath: appNodePath } = writeEntity(graphDir, appNode);

  // Write platform-specific rules and register MCP server
  const platformResult = writePlatformRules(targetDir, environment, "", config);

  return {
    configPath,
    appNodePath,
    appId,
    platformRulesPath: platformResult.filePath,
    mcpRegistered: platformResult.mcpRegistered,
    mcpSetupPath: platformResult.mcpSetupPath,
  };
}

// ============================================================
// CLI Wiring
// ============================================================

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a new whygraph project in the current directory")
    .option("--app-name <name>", "Application name (skips prompt)")
    .option(
      "--environment <env>",
      "Environment: claude-code, cursor, copilot, other (skips prompt)",
    )
    .option("--json", "Output results as JSON")
    .action(async (opts: { appName?: string; environment?: string; json?: boolean }) => {
      try {
        const result = await runInit(process.cwd(), {
          appName: opts.appName,
          environment: opts.environment as Environment | undefined,
          json: opts.json,
        });

        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } else {
          const mcpLine = result.mcpRegistered
            ? `  MCP: registered\n`
            : `  MCP: setup failed — see ${result.mcpSetupPath} for manual instructions\n`;
          process.stdout.write(
            `Initialized whygraph in .whygraph/\n` +
            `  App node: ${result.appId}\n` +
            `  Config: ${result.configPath}\n` +
            mcpLine +
            `\nRun 'whygraph up' to start the server.\n`,
          );
        }
      } catch (err: unknown) {
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
