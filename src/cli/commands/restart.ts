import type { Command } from "commander";
import { runDown } from "./down.js";
import { runUp } from "./up.js";

export async function runRestart(
  targetDir: string,
  options: { port?: number; json?: boolean } = {},
): Promise<{ stopped: boolean; url: string; port: number; pid: number }> {
  const downResult = await runDown(targetDir, options);
  const upResult = await runUp(targetDir, options);

  return {
    stopped: downResult.stopped,
    ...upResult,
  };
}

export function registerRestartCommand(program: Command): void {
  program
    .command("restart")
    .description("Stop and restart the whygraph server")
    .option("--port <number>", "Port number")
    .option("--json", "Output results as JSON")
    .action(async (opts: { port?: string; json?: boolean }) => {
      try {
        const port = opts.port ? parseInt(opts.port, 10) : undefined;
        const result = await runRestart(process.cwd(), { port, json: opts.json });

        if (opts.json) {
          process.stdout.write(JSON.stringify(result) + "\n");
        } else {
          if (result.stopped) {
            process.stdout.write(`Stopped previous server\n`);
          }
          process.stdout.write(
            `whygraph server running at ${result.url} (pid ${result.pid})\n`,
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
