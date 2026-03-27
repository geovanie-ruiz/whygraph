import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import type { Command } from "commander";

// ============================================================
// Find .whygraph directory (reuse serve's logic inline)
// ============================================================

function findWhygraphDir(startDir: string): string | null {
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

  /* v8 ignore next 3 */
  if (existsSync(join(root, ".whygraph"))) {
    return root;
  }

  return null;
}

// ============================================================
// Core Logic
// ============================================================

export async function runViz(
  targetDir: string,
  options: { port?: number } = {},
): Promise<{ url: string }> {
  const projectDir = findWhygraphDir(targetDir);
  if (!projectDir) {
    throw new Error(
      `.whygraph/ not found. Run "whygraph init" first.`,
    );
  }

  const port = options.port ?? 4777;
  const url = `http://localhost:${port}`;

  // Check if server is running via health check
  let serverRunning = false;
  try {
    const response = await fetch(`${url}/api/health`);
    if (response.ok) {
      serverRunning = true;
    }
  } catch {
    // Server not running
  }

  // If not running, start it in background
  if (!serverRunning) {
    const child = spawn("whygraph", ["serve", "--port", String(port)], {
      cwd: projectDir,
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    // Brief wait for server to start
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Open browser
  const open = await import("open");
  await open.default(url);

  return { url };
}

// ============================================================
// CLI Wiring
// ============================================================

export function registerVizCommand(program: Command): void {
  program
    .command("viz")
    .description("Open the whygraph visualization in a browser")
    .option("--port <number>", "Port number", "4777")
    .option("--json", "Output results as JSON")
    .action(async (opts: { port?: string; json?: boolean }) => {
      try {
        /* v8 ignore next 1 */
        const port = opts.port ? parseInt(opts.port, 10) : undefined;
        const result = await runViz(process.cwd(), { port });

        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } else {
          process.stdout.write(`Opening whygraph at ${result.url}\n`);
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
