import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import yaml from "js-yaml";
import type { WhygraphConfig } from "../../entity/types.js";
import { findWhygraphDir } from "./serve.js";

// ============================================================
// Types
// ============================================================

export interface StatusResult {
  serverRunning: boolean;
  serverPort: number;
  entityCount?: number;
  nodeCount?: number;
  decisionCount?: number;
  error?: string;
}

// ============================================================
// Core Logic
// ============================================================

export async function runStatus(targetDir: string): Promise<StatusResult> {
  const projectDir = findWhygraphDir(targetDir);
  if (!projectDir) {
    throw new Error(
      `.whygraph/ not found. Run "whygraph init" first.`,
    );
  }

  const configPath = join(projectDir, ".whygraph", "config.yaml");
  if (!existsSync(configPath)) {
    throw new Error(
      `.whygraph/config.yaml not found. Run "whygraph init" first.`,
    );
  }

  const raw = readFileSync(configPath, "utf-8");
  const config = yaml.load(raw) as WhygraphConfig;
  const port = config.serverPort;

  // Try to connect to the server
  try {
    const healthRes = await fetch(`http://localhost:${port}/api/health`);
    if (!healthRes.ok) {
      return { serverRunning: false, serverPort: port, error: "Health check failed" };
    }

    // Query GraphQL for status
    const gqlRes = await fetch(`http://localhost:${port}/api/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{ status { running entityCount nodeCount decisionCount } }`,
      }),
    });

    if (!gqlRes.ok) {
      return { serverRunning: true, serverPort: port, error: "GraphQL query failed" };
    }

    const gqlData = (await gqlRes.json()) as {
      data?: {
        status: {
          running: boolean;
          entityCount: number;
          nodeCount: number;
          decisionCount: number;
        };
      };
    };

    const status = gqlData.data?.status;
    if (!status) {
      return { serverRunning: true, serverPort: port, error: "Unexpected GraphQL response" };
    }

    return {
      serverRunning: true,
      serverPort: port,
      entityCount: status.entityCount,
      nodeCount: status.nodeCount,
      decisionCount: status.decisionCount,
    };
  } catch {
    return { serverRunning: false, serverPort: port };
  }
}

// ============================================================
// CLI Wiring
// ============================================================

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Check the whygraph server status and entity counts")
    .option("--json", "Output results as JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        const result = await runStatus(process.cwd());

        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } else {
          if (result.serverRunning) {
            process.stdout.write(
              `Server: running (port ${result.serverPort})\n` +
              `  Entities: ${result.entityCount ?? "unknown"}\n` +
              `  Nodes: ${result.nodeCount ?? "unknown"}\n` +
              `  Decisions: ${result.decisionCount ?? "unknown"}\n`,
            );
          } else {
            process.stdout.write(
              `Server: not running (port ${result.serverPort})\n`,
            );
          }
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
