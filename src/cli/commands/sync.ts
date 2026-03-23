import * as fs from "node:fs";
import * as path from "node:path";
import type { Command } from "commander";
import prompts from "prompts";
import { processStaging } from "../../staging/processor.js";
import { getActive, deregister } from "../../staging/sessions.js";
import type { WhygraphConfig, ProcessResult } from "../../core/types.js";

// ── Directory discovery ─────────────────────────────────────

export function findWhygraphDir(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, ".whygraph");
    if (fs.existsSync(path.join(candidate, "config.json"))) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

// ── Config loading ──────────────────────────────────────────

function loadConfig(whygraphDir: string): WhygraphConfig | null {
  try {
    const raw = fs.readFileSync(
      path.join(whygraphDir, "config.json"),
      "utf-8",
    );
    return JSON.parse(raw) as WhygraphConfig;
  } catch {
    return null;
  }
}

// ── Session flushing ────────────────────────────────────────

export async function flushSessions(whygraphDir: string): Promise<void> {
  const sessions = await getActive(whygraphDir);
  for (const session of sessions) {
    await deregister(whygraphDir, session.id);
  }
}

// ── Result formatting ───────────────────────────────────────

export interface SyncOutput {
  success: boolean;
  eventsAppended: number;
  errorsFound: number;
  reviewsCreated: number;
  filesProcessed: number;
  message: string;
}

function buildOutput(result: ProcessResult): SyncOutput {
  const parts: string[] = [];
  if (result.filesProcessed === 0) {
    return {
      success: true,
      ...result,
      message: "No staging files to process.",
    };
  }
  parts.push(`Processed ${result.filesProcessed} staging file(s)`);
  parts.push(`${result.eventsAppended} event(s) appended`);
  if (result.errorsFound > 0) {
    parts.push(`${result.errorsFound} error(s) found`);
  }
  if (result.reviewsCreated > 0) {
    parts.push(`${result.reviewsCreated} review(s) created`);
  }
  return {
    success: true,
    ...result,
    message: parts.join(". ") + ".",
  };
}

// ── Core sync logic (testable) ──────────────────────────────

export interface SyncOptions {
  flush?: boolean;
  json?: boolean;
}

export async function runSync(
  startDir: string,
  options: SyncOptions,
  deps: {
    prompt?: typeof prompts;
    log?: (msg: string) => void;
    logJson?: (obj: unknown) => void;
  } = {},
): Promise<SyncOutput> {
  const log = deps.log ?? ((msg: string) => console.log(msg));
  const logJson = deps.logJson ?? ((obj: unknown) => console.log(JSON.stringify(obj)));
  const prompt = deps.prompt ?? prompts;

  // 1. Find .whygraph directory
  const whygraphDir = findWhygraphDir(startDir);
  if (!whygraphDir) {
    const output: SyncOutput = {
      success: false,
      eventsAppended: 0,
      errorsFound: 0,
      reviewsCreated: 0,
      filesProcessed: 0,
      message: "No .whygraph directory found.",
    };
    if (options.json) {
      logJson(output);
    } else {
      log(output.message);
    }
    return output;
  }

  // 2. Check active sessions
  const activeSessions = await getActive(whygraphDir);

  if (activeSessions.length > 0) {
    if (options.flush) {
      // --flush: clear all sessions unconditionally
      await flushSessions(whygraphDir);
    } else {
      // Check if sync trigger is manual
      const config = loadConfig(whygraphDir);
      const isManual = config?.syncTrigger === "manual";

      if (isManual) {
        const response = await prompt({
          type: "select",
          name: "action",
          message: `${activeSessions.length} active session(s) found. Flush sessions and proceed?`,
          choices: [
            { title: "Flush sessions and sync", value: "flush" },
            { title: "Skip sync", value: "skip" },
          ],
        });

        if (response.action === "skip" || response.action === undefined) {
          const output: SyncOutput = {
            success: true,
            eventsAppended: 0,
            errorsFound: 0,
            reviewsCreated: 0,
            filesProcessed: 0,
            message: "Sync skipped — active sessions remain.",
          };
          if (options.json) {
            logJson(output);
          } else {
            log(output.message);
          }
          return output;
        }

        await flushSessions(whygraphDir);
      }
    }
  }

  // 3. Process staging
  const result = await processStaging(whygraphDir);
  const output = buildOutput(result);

  if (options.json) {
    logJson(output);
  } else {
    log(output.message);
  }

  return output;
}

// ── Commander wiring ────────────────────────────────────────

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Process all staging files into the event log")
    .option("--flush", "Clear all active sessions and proceed")
    .option("--json", "Output structured JSON")
    .action(async (opts: { flush?: boolean; json?: boolean }) => {
      const output = await runSync(process.cwd(), {
        flush: opts.flush,
        json: opts.json,
      });
      if (!output.success) {
        process.exitCode = 1;
      }
    });
}
