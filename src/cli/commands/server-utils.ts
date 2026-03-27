import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import * as yaml from "js-yaml";

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

  /* v8 ignore next 3 */
  if (existsSync(join(root, ".whygraph"))) {
    return root;
  }

  return null;
}

export function getConfiguredPort(projectDir: string): number {
  const configPath = join(projectDir, ".whygraph", "config.yaml");
  try {
    const content = readFileSync(configPath, "utf-8");
    const config = yaml.load(content) as Record<string, unknown>;
    return (config.serverPort as number) ?? 4777;
  } catch {
    return 4777;
  }
}

export function killProcessOnPort(port: number): boolean {
  try {
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

export async function waitForPortFree(port: number, timeoutMs: number = 3000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(`http://localhost:${port}/api/health`);
      await new Promise((r) => setTimeout(r, 200));
    } catch {
      return;
    }
  }
  throw new Error(`Port ${port} still in use after ${timeoutMs}ms`);
}

export async function waitForServerReady(port: number, timeoutMs: number = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`);
      /* v8 ignore next 1 */
      if (res.ok) return;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server not ready on port ${port} after ${timeoutMs}ms`);
}

export function isServerRunning(port: number): boolean {
  try {
    execSync(`lsof -ti:${port}`, { encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}
