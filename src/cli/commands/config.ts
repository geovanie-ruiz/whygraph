import * as fs from "node:fs";
import * as path from "node:path";
import type { Command } from "commander";
import type {
  WhygraphConfig,
  Environment,
  SyncTrigger,
  ContextInjection,
  AutonomyLevel,
} from "../../core/types.js";
import { findWhygraphDir } from "./sync.js";

// ── Valid values ─────────────────────────────────────────────

const VALID_CONTEXT_INJECTION: readonly ContextInjection[] = [
  "always",
  "ask",
  "never",
];
const VALID_AUTONOMY: readonly AutonomyLevel[] = [
  "full",
  "supervised",
  "manual",
];
const VALID_SYNC_TRIGGER: readonly SyncTrigger[] = [
  "hook",
  "git-hook",
  "manual",
];
const VALID_ENVIRONMENT: readonly Environment[] = [
  "claude-code",
  "cursor",
  "copilot",
  "other",
];

// ── Types ────────────────────────────────────────────────────

export interface ConfigOptions {
  json?: boolean;
  contextInjection?: string;
  autonomy?: string;
  syncTrigger?: string;
  environment?: string;
}

export interface ConfigChange {
  from: string;
  to: string;
}

export interface ConfigOutput {
  success: boolean;
  config?: WhygraphConfig;
  changes: Record<string, ConfigChange>;
  message: string;
}

// ── Validation ───────────────────────────────────────────────

interface ValidationError {
  flag: string;
  value: string;
  valid: readonly string[];
}

function validateOptions(
  opts: ConfigOptions,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (
    opts.contextInjection !== undefined &&
    !VALID_CONTEXT_INJECTION.includes(opts.contextInjection as ContextInjection)
  ) {
    errors.push({
      flag: "context-injection",
      value: opts.contextInjection,
      valid: VALID_CONTEXT_INJECTION,
    });
  }

  if (
    opts.autonomy !== undefined &&
    !VALID_AUTONOMY.includes(opts.autonomy as AutonomyLevel)
  ) {
    errors.push({
      flag: "autonomy",
      value: opts.autonomy,
      valid: VALID_AUTONOMY,
    });
  }

  if (
    opts.syncTrigger !== undefined &&
    !VALID_SYNC_TRIGGER.includes(opts.syncTrigger as SyncTrigger)
  ) {
    errors.push({
      flag: "sync-trigger",
      value: opts.syncTrigger,
      valid: VALID_SYNC_TRIGGER,
    });
  }

  if (
    opts.environment !== undefined &&
    !VALID_ENVIRONMENT.includes(opts.environment as Environment)
  ) {
    errors.push({
      flag: "environment",
      value: opts.environment,
      valid: VALID_ENVIRONMENT,
    });
  }

  return errors;
}

// ── Config I/O ───────────────────────────────────────────────

function loadConfig(whygraphDir: string): WhygraphConfig {
  const raw = fs.readFileSync(
    path.join(whygraphDir, "config.json"),
    "utf-8",
  );
  return JSON.parse(raw) as WhygraphConfig;
}

function saveConfig(whygraphDir: string, config: WhygraphConfig): void {
  fs.writeFileSync(
    path.join(whygraphDir, "config.json"),
    JSON.stringify(config, null, 2) + "\n",
    "utf-8",
  );
}

// ── Core logic ───────────────────────────────────────────────

export async function runConfig(
  startDir: string,
  opts: ConfigOptions,
  deps: {
    log?: (msg: string) => void;
    logJson?: (obj: unknown) => void;
  } = {},
): Promise<ConfigOutput> {
  const log = deps.log ?? ((msg: string) => console.log(msg));
  const logJson =
    deps.logJson ?? ((obj: unknown) => console.log(JSON.stringify(obj)));

  // 1. Find .whygraph directory
  const whygraphDir = findWhygraphDir(startDir);
  if (!whygraphDir) {
    const output: ConfigOutput = {
      success: false,
      changes: {},
      message: "No .whygraph directory found. Run `whygraph init` first.",
    };
    if (opts.json) {
      logJson(output);
    } else {
      log(output.message);
    }
    return output;
  }

  // 2. Validate all provided flags before reading/writing
  const validationErrors = validateOptions(opts);
  if (validationErrors.length > 0) {
    const parts = validationErrors.map(
      (e) =>
        `Invalid value "${e.value}" for --${e.flag}. Valid values: ${e.valid.join(", ")}`,
    );
    const output: ConfigOutput = {
      success: false,
      changes: {},
      message: parts.join("\n"),
    };
    if (opts.json) {
      logJson(output);
    } else {
      log(output.message);
    }
    return output;
  }

  // 3. Load current config
  const config = loadConfig(whygraphDir);

  // 4. Determine if this is a read or update
  const hasUpdates =
    opts.contextInjection !== undefined ||
    opts.autonomy !== undefined ||
    opts.syncTrigger !== undefined ||
    opts.environment !== undefined;

  if (!hasUpdates) {
    // View mode: display current config
    const output: ConfigOutput = {
      success: true,
      config,
      changes: {},
      message: "Current configuration",
    };
    if (opts.json) {
      logJson(output);
    } else {
      log("Current configuration:");
      log(`  appName:          ${config.appName}`);
      log(`  environment:      ${config.environment}`);
      log(`  syncTrigger:      ${config.syncTrigger}`);
      log(`  contextInjection: ${config.contextInjection}`);
      log(`  autonomy:         ${config.autonomy}`);
    }
    return output;
  }

  // 5. Apply changes, tracking what actually changed
  const changes: Record<string, ConfigChange> = {};

  if (
    opts.contextInjection !== undefined &&
    opts.contextInjection !== config.contextInjection
  ) {
    changes.contextInjection = {
      from: config.contextInjection,
      to: opts.contextInjection,
    };
    config.contextInjection = opts.contextInjection as ContextInjection;
  }

  if (opts.autonomy !== undefined && opts.autonomy !== config.autonomy) {
    changes.autonomy = { from: config.autonomy, to: opts.autonomy };
    config.autonomy = opts.autonomy as AutonomyLevel;
  }

  if (
    opts.syncTrigger !== undefined &&
    opts.syncTrigger !== config.syncTrigger
  ) {
    changes.syncTrigger = {
      from: config.syncTrigger,
      to: opts.syncTrigger,
    };
    config.syncTrigger = opts.syncTrigger as SyncTrigger;
  }

  if (
    opts.environment !== undefined &&
    opts.environment !== config.environment
  ) {
    changes.environment = {
      from: config.environment,
      to: opts.environment,
    };
    config.environment = opts.environment as Environment;
  }

  // 6. Handle no-op
  if (Object.keys(changes).length === 0) {
    const output: ConfigOutput = {
      success: true,
      config,
      changes: {},
      message: "No changes — values already match.",
    };
    if (opts.json) {
      logJson(output);
    } else {
      log(output.message);
    }
    return output;
  }

  // 7. Write updated config
  saveConfig(whygraphDir, config);

  // 8. Build confirmation
  const parts = Object.entries(changes).map(
    ([key, change]) => `${key}: ${change.from} -> ${change.to}`,
  );
  const message = `Updated: ${parts.join(", ")}`;

  const output: ConfigOutput = {
    success: true,
    config,
    changes,
    message,
  };

  if (opts.json) {
    logJson(output);
  } else {
    log(message);
  }

  return output;
}

// ── Commander wiring ─────────────────────────────────────────

export function registerConfigCommand(program: Command): void {
  program
    .command("config")
    .description("View or update whygraph configuration")
    .option("--json", "Output structured JSON")
    .option(
      "--context-injection <value>",
      "Context injection mode (always, ask, never)",
    )
    .option(
      "--autonomy <value>",
      "Agent autonomy level (full, supervised, manual)",
    )
    .option(
      "--sync-trigger <value>",
      "Sync trigger mode (hook, git-hook, manual)",
    )
    .option(
      "--environment <value>",
      "Development environment (claude-code, cursor, copilot, other)",
    )
    .action(
      async (opts: {
        json?: boolean;
        contextInjection?: string;
        autonomy?: string;
        syncTrigger?: string;
        environment?: string;
      }) => {
        const output = await runConfig(process.cwd(), {
          json: opts.json,
          contextInjection: opts.contextInjection,
          autonomy: opts.autonomy,
          syncTrigger: opts.syncTrigger,
          environment: opts.environment,
        });
        if (!output.success) {
          process.exitCode = 1;
        }
      },
    );
}
