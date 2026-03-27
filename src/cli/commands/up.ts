import { spawn as nodeSpawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import {
  findWhygraphDir,
  getConfiguredPort,
  isServerRunning,
  waitForServerReady,
} from "./server-utils.js";

export async function runUp(
  targetDir: string,
  options: {
    port?: number;
    json?: boolean;
    spawner?: typeof nodeSpawn;
    waitForReady?: (port: number) => Promise<void>;
  } = {},
): Promise<{ url: string; port: number; pid: number }> {
  const projectDir = findWhygraphDir(targetDir);
  if (!projectDir) {
    throw new Error(`.whygraph/ not found. Run "whygraph init" first.`);
  }

  const port = options.port ?? getConfiguredPort(projectDir);

  if (isServerRunning(port)) {
    throw new Error(`Server already running on port ${port}. Use "whygraph restart" or "whygraph down" first.`);
  }

  // Spawn the serve command as a detached background process
  const spawn = options.spawner ?? nodeSpawn;
  const serveScript = join(dirname(fileURLToPath(import.meta.url)), "..", "index.js");
  const child = spawn(
    process.execPath,
    [serveScript, "serve", "--port", String(port)],
    {
      detached: true,
      stdio: "ignore",
      cwd: projectDir,
    },
  );

  child.unref();

  const pid = child.pid!;

  // Wait for the server to be ready
  const waitFn = options.waitForReady ?? waitForServerReady;
  await waitFn(port);

  return {
    url: `http://localhost:${port}`,
    port,
    pid,
  };
}

export function registerUpCommand(program: Command): void {
  program
    .command("up")
    .description("Start the whygraph server in the background")
    .option("--port <number>", "Port number")
    .option("--json", "Output results as JSON")
    .action(async (opts: { port?: string; json?: boolean }) => {
      try {
        const port = opts.port ? parseInt(opts.port, 10) : undefined;
        const result = await runUp(process.cwd(), { port, json: opts.json });

        if (opts.json) {
          process.stdout.write(JSON.stringify(result) + "\n");
        } else {
          process.stdout.write(
            `whygraph server running at ${result.url} (pid ${result.pid})\n`,
          );
        }
      } catch (err: unknown) {
        /* v8 ignore next 1 */
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
