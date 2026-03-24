import type { Command } from "commander";
import {
  findWhygraphDir,
  getConfiguredPort,
  killProcessOnPort,
  waitForPortFree,
} from "./server-utils.js";

export async function runDown(
  targetDir: string,
  options: { port?: number; json?: boolean } = {},
): Promise<{ stopped: boolean; port: number }> {
  const projectDir = findWhygraphDir(targetDir);
  if (!projectDir) {
    throw new Error(`.whygraph/ not found. Run "whygraph init" first.`);
  }

  const port = options.port ?? getConfiguredPort(projectDir);
  const killed = killProcessOnPort(port);

  if (killed) {
    await waitForPortFree(port);
  }

  return { stopped: killed, port };
}

export function registerDownCommand(program: Command): void {
  program
    .command("down")
    .description("Stop the whygraph server")
    .option("--port <number>", "Port number")
    .option("--json", "Output results as JSON")
    .action(async (opts: { port?: string; json?: boolean }) => {
      try {
        const port = opts.port ? parseInt(opts.port, 10) : undefined;
        const result = await runDown(process.cwd(), { port, json: opts.json });

        if (opts.json) {
          process.stdout.write(JSON.stringify(result) + "\n");
        } else if (result.stopped) {
          process.stdout.write(`whygraph server stopped (port ${result.port})\n`);
        } else {
          process.stdout.write(`No server running on port ${result.port}\n`);
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
