import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import yaml from "js-yaml";
import type {
  WhygraphConfig,
  Environment,
  MpcMode,
  DecisionTag,
} from "../../entity/types.js";
import { DECISION_TAGS } from "../../entity/types.js";

// ============================================================
// Types
// ============================================================

export interface ConfigUpdates {
  environment?: string;
  mpcMode?: string;
  serverPort?: number;
  tags?: string[];
}

export interface ConfigResult {
  config: WhygraphConfig;
  updated: boolean;
}

// ============================================================
// Validation
// ============================================================

const VALID_ENVIRONMENTS: readonly string[] = [
  "claude-code",
  "cursor",
  "copilot",
  "other",
];
const VALID_MPC_MODES: readonly string[] = ["default", "strict"];

function validateUpdates(updates: ConfigUpdates): void {
  if (
    updates.environment !== undefined &&
    !VALID_ENVIRONMENTS.includes(updates.environment)
  ) {
    throw new Error(
      `Invalid environment "${updates.environment}". Must be one of: ${VALID_ENVIRONMENTS.join(", ")}`,
    );
  }

  if (
    updates.mpcMode !== undefined &&
    !VALID_MPC_MODES.includes(updates.mpcMode)
  ) {
    throw new Error(
      `Invalid mpcMode "${updates.mpcMode}". Must be one of: ${VALID_MPC_MODES.join(", ")}`,
    );
  }

  if (updates.serverPort !== undefined) {
    if (typeof updates.serverPort !== "number" || isNaN(updates.serverPort)) {
      throw new Error(`Invalid serverPort "${updates.serverPort}". Must be a number.`);
    }
  }

  if (updates.tags !== undefined) {
    for (const tag of updates.tags) {
      if (!(DECISION_TAGS as readonly string[]).includes(tag)) {
        throw new Error(
          `Invalid tag "${tag}". Must be one of: ${DECISION_TAGS.join(", ")}`,
        );
      }
    }
  }
}

// ============================================================
// Core Logic
// ============================================================

export function runConfig(
  whygraphDir: string,
  updates?: ConfigUpdates,
): ConfigResult {
  const configPath = join(whygraphDir, ".whygraph", "config.yaml");

  if (!existsSync(configPath)) {
    throw new Error(
      `.whygraph/ not found in ${whygraphDir}. Run "whygraph init" first.`,
    );
  }

  const raw = readFileSync(configPath, "utf-8");
  const config = yaml.load(raw) as WhygraphConfig;

  if (!updates || Object.keys(updates).length === 0) {
    return { config, updated: false };
  }

  validateUpdates(updates);

  if (updates.environment !== undefined) {
    config.environment = updates.environment as Environment;
  }
  if (updates.mpcMode !== undefined) {
    config.mpcMode = updates.mpcMode as MpcMode;
  }
  if (updates.serverPort !== undefined) {
    config.serverPort = updates.serverPort;
  }
  if (updates.tags !== undefined) {
    config.tags = updates.tags as DecisionTag[];
  }

  const configYaml = yaml.dump(config, { lineWidth: -1 });
  writeFileSync(configPath, configYaml, "utf-8");

  return { config, updated: true };
}

// ============================================================
// CLI Wiring
// ============================================================

function formatConfig(config: WhygraphConfig): string {
  const lines: string[] = [
    `appName:     ${config.appName}`,
    `environment: ${config.environment}`,
    `prefix:      ${config.prefix}`,
    `idLength:    ${config.idLength}`,
    `tags:        ${config.tags.join(", ")}`,
    `mpcMode:     ${config.mpcMode}`,
    `serverPort:  ${config.serverPort}`,
  ];
  return lines.join("\n");
}

export function registerConfigCommand(program: Command): void {
  program
    .command("config")
    .description("View or update whygraph configuration")
    .option("--environment <env>", "Update environment")
    .option("--mpc-mode <mode>", "Update MPC mode (default | strict)")
    .option("--server-port <port>", "Update server port")
    .option("--json", "Output results as JSON")
    .action(
      (opts: {
        environment?: string;
        mpcMode?: string;
        serverPort?: string;
        json?: boolean;
      }) => {
        try {
          const updates: ConfigUpdates = {};
          if (opts.environment !== undefined)
            updates.environment = opts.environment;
          if (opts.mpcMode !== undefined) updates.mpcMode = opts.mpcMode;
          if (opts.serverPort !== undefined)
            updates.serverPort = Number(opts.serverPort);

          const hasUpdates = Object.keys(updates).length > 0;
          const result = runConfig(
            process.cwd(),
            hasUpdates ? updates : undefined,
          );

          if (opts.json) {
            process.stdout.write(JSON.stringify(result, null, 2) + "\n");
          } else {
            if (result.updated) {
              process.stdout.write("Configuration updated.\n\n");
            }
            process.stdout.write(formatConfig(result.config) + "\n");
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
      },
    );
}
