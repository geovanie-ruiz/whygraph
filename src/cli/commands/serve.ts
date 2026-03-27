import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Command } from "commander";
import { ServerCore } from "../../server/core.js";
import { FileWatcher } from "../../server/watcher.js";
import { WorktreeWatcher } from "../../server/worktree-watcher.js";
import { createHttpServer } from "../../server/http.js";
import { parseEntity } from "../../entity/parser.js";

// ============================================================
// Types
// ============================================================

export interface ServeOptions {
  port?: number;
  json?: boolean;
}

export interface ServeResult {
  url: string;
  entities: number;
  port: number;
  stop: () => Promise<void>;
}

// ============================================================
// Find .whygraph directory
// ============================================================

export function findWhygraphDir(startDir: string): string | null {
  let current = resolve(startDir);
  const root = resolve("/");

  while (current !== root) {
    const candidate = join(current, ".whygraph");
    if (existsSync(candidate)) {
      return current;
    }
    const parent = resolve(current, "..");
    /* v8 ignore next 2 */
    if (parent === current) break;
    current = parent;
  }

  // Check root too
  /* v8 ignore next 3 */
  if (existsSync(join(root, ".whygraph"))) {
    return root;
  }

  return null;
}

// ============================================================
// Core Logic
// ============================================================

export async function runServe(
  targetDir: string,
  options: ServeOptions = {},
): Promise<ServeResult> {
  const projectDir = findWhygraphDir(targetDir);
  if (!projectDir) {
    throw new Error(
      `.whygraph/ not found. Run "whygraph init" first.`,
    );
  }

  const whygraphDir = join(projectDir, ".whygraph");
  /* v8 ignore next 1 */
  const port = options.port ?? 4777;

  // Create and load ServerCore
  const core = new ServerCore(whygraphDir);
  await core.load();

  // Start file watcher on main graph dir
  const graphDir = join(whygraphDir, "graph");
  const mainWatcher = new FileWatcher(graphDir);
  mainWatcher.start((events) => {
    for (const event of events) {
      if (event.type === "deleted" && event.entityId) {
        core.removeEntity(event.entityId);
      } else {
        /* v8 ignore next 1 */
        if (event.entityId) {
          fs.readFile(event.filePath, "utf-8")
            .then((content) => {
              const entity = parseEntity(content);
              /* v8 ignore next 1 */
              if (entity) {
                core.addOrUpdateEntity(entity.id, entity);
              }
            })
            /* v8 ignore start */
            .catch(() => {});
            /* v8 ignore stop */
        }
      }
    }
  });

  // Start worktree watcher
  const worktreeWatcher = new WorktreeWatcher(core, projectDir);
  await worktreeWatcher.startWatching();

  // Start HTTP server
  const httpServer = createHttpServer(core, port);
  await httpServer.start();

  const url = `http://localhost:${port}`;

  // Set up graceful shutdown
  const shutdown = async (): Promise<void> => {
    await httpServer.stop();
    await worktreeWatcher.stop();
    await mainWatcher.stop();
  };

  /* v8 ignore next 3 */
  process.on("SIGINT", () => { shutdown().then(() => process.exit(0)); });
  /* v8 ignore next 3 */
  process.on("SIGTERM", () => { shutdown().then(() => process.exit(0)); });

  return {
    url,
    entities: core.getAllEntities().length,
    port,
    stop: shutdown,
  };
}

// ============================================================
// CLI Wiring
// ============================================================

export function registerServeCommand(program: Command): void {
  program
    .command("serve")
    .description("Start the whygraph server")
    .option("--port <number>", "Port number", "4777")
    .option("--json", "Output results as JSON")
    .action(async (opts: { port?: string; json?: boolean }) => {
      try {
        /* v8 ignore next 1 */
        const port = opts.port ? parseInt(opts.port, 10) : undefined;
        const result = await runServe(process.cwd(), { port, json: opts.json });

        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } else {
          process.stdout.write(
            `whygraph server running at ${result.url}\n` +
            `  Entities loaded: ${result.entities}\n` +
            `  Press Ctrl+C to stop\n`,
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
