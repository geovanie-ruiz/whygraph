import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import type { Command } from "commander";
import * as yaml from "js-yaml";

function findWhygraphDir(startDir: string): string | null {
  let current = resolve(startDir);
  const root = resolve("/");

  while (current !== root) {
    const candidate = join(current, ".whygraph");
    if (existsSync(candidate)) {
      return current;
    }
    const parent = resolve(current, "..");
    if (parent === current) break;
    current = parent;
  }

  if (existsSync(join(root, ".whygraph"))) {
    return root;
  }

  return null;
}

function getConfiguredPort(whygraphDir: string): number {
  const configPath = join(whygraphDir, ".whygraph", "config.yaml");
  try {
    const content = readFileSync(configPath, "utf-8");
    const config = yaml.load(content) as Record<string, unknown>;
    return (config.serverPort as number) ?? 4777;
  } catch {
    return 4777;
  }
}

function killProcessOnPort(port: number): boolean {
  try {
    // Find PID listening on port
    const result = execSync(`lsof -ti:${port}`, { encoding: "utf-8" }).trim();
    if (result) {
      const pids = result.split("\n").map((p) => p.trim()).filter(Boolean);
      for (const pid of pids) {
        try {
          execSync(`kill ${pid}`);
        } catch {
          // Process may have already exited
        }
      }
      return true;
    }
  } catch {
    // No process on that port
  }
  return false;
}

async function waitForPortFree(port: number, timeoutMs: number = 3000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(`http://localhost:${port}/api/health`);
      // Still running, wait
      await new Promise((r) => setTimeout(r, 200));
    } catch {
      // Connection refused — port is free
      return;
    }
  }
  throw new Error(`Port ${port} still in use after ${timeoutMs}ms`);
}

export interface RestartOptions {
  port?: number;
  json?: boolean;
}

export async function runRestart(
  targetDir: string,
  options: RestartOptions = {},
): Promise<{ killed: boolean; port: number }> {
  const projectDir = findWhygraphDir(targetDir);
  if (!projectDir) {
    throw new Error(`.whygraph/ not found. Run "whygraph init" first.`);
  }

  const port = options.port ?? getConfiguredPort(projectDir);

  // Kill existing server
  const killed = killProcessOnPort(port);

  if (killed) {
    await waitForPortFree(port);
  }

  return { killed, port };
}

export function registerRestartCommand(program: Command): void {
  program
    .command("restart")
    .description("Stop the running whygraph server then start a new one")
    .option("--port <number>", "Port number")
    .option("--json", "Output results as JSON")
    .action(async (opts: { port?: string; json?: boolean }) => {
      try {
        const port = opts.port ? parseInt(opts.port, 10) : undefined;
        const result = await runRestart(process.cwd(), { port, json: opts.json });

        if (result.killed) {
          if (opts.json) {
            process.stdout.write(JSON.stringify({ stopped: true, port: result.port }) + "\n");
          } else {
            process.stdout.write(`Stopped server on port ${result.port}\n`);
          }
        } else {
          if (opts.json) {
            process.stdout.write(JSON.stringify({ stopped: false, port: result.port }) + "\n");
          } else {
            process.stdout.write(`No server running on port ${result.port}\n`);
          }
        }

        // Now start the server by importing and calling runServe
        const { runServe } = await import("./serve.js");
        const serveResult = await runServe(process.cwd(), { port: result.port });

        if (opts.json) {
          process.stdout.write(JSON.stringify({ started: true, ...serveResult }) + "\n");
        } else {
          process.stdout.write(
            `whygraph server running at ${serveResult.url}\n` +
            `  Entities loaded: ${serveResult.entities}\n` +
            `  Press Ctrl+C to stop\n`,
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (opts.json) {
          process.stdout.write(JSON.stringify({ error: message }) + "\n");
        } else {
          process.stderr.write(`Error: ${message}\n`);
        }
        process.exitCode = 1;
      }
    });
}
