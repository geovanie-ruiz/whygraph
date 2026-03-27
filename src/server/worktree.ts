import * as path from "node:path";
import * as fs from "node:fs/promises";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFileCb);

// ============================================================
// Types
// ============================================================

export interface WorktreeInfo {
  path: string;
  branch: string;
  graphDir: string;
}

export interface ParsedWorktree {
  path: string;
  branch: string | null;
  isMain: boolean;
}

/** Dependency injection for testing. */
export interface DetectDeps {
  execFile: (cmd: string, args: string[], opts: { cwd: string }) => Promise<{ stdout: string; stderr: string }>;
  access: (p: string) => Promise<void>;
}

// ============================================================
// Parse porcelain output
// ============================================================

export function parseWorktreeList(output: string): ParsedWorktree[] {
  const trimmed = output.trim();
  if (trimmed === "") return [];

  const results: ParsedWorktree[] = [];
  const lines = trimmed.split("\n");

  let current: Partial<ParsedWorktree> = {};
  let isFirst = true;

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      current = { path: line.slice("worktree ".length) };
    } else if (line.startsWith("branch ")) {
      const ref = line.slice("branch ".length);
      current.branch = ref.replace("refs/heads/", "");
    } else if (line === "detached") {
      current.branch = null;
    } else if (line === "") {
      if (current.path !== undefined) {
        results.push({
          path: current.path,
          branch: current.branch ?? null,
          isMain: isFirst,
        });
        isFirst = false;
        current = {};
      }
    }
  }

  // Handle trailing entry without final blank line
  if (current.path !== undefined) {
    results.push({
      path: current.path,
      branch: current.branch ?? null,
      isMain: isFirst,
    });
  }

  return results;
}

// ============================================================
// Detect worktrees with whygraph graphs
// ============================================================

export async function detectWorktrees(
  repoDir: string,
  deps?: DetectDeps,
): Promise<WorktreeInfo[]> {
  /* v8 ignore next 3 */
  const run = deps?.execFile ?? ((cmd: string, args: string[], opts: { cwd: string }) =>
    execFileAsync(cmd, args, { cwd: opts.cwd }));
  /* v8 ignore next 1 */
  const checkAccess = deps?.access ?? ((p: string) => fs.access(p));

  let stdout: string;
  try {
    const result = await run("git", ["worktree", "list", "--porcelain"], { cwd: repoDir });
    stdout = result.stdout;
  } catch {
    return [];
  }

  const parsed = parseWorktreeList(stdout);
  const nonMain = parsed.filter((wt) => !wt.isMain && wt.branch !== null);

  const results: WorktreeInfo[] = [];

  for (const wt of nonMain) {
    const graphDir = path.join(wt.path, ".whygraph", "graph");
    try {
      await checkAccess(graphDir);
      results.push({
        path: wt.path,
        branch: wt.branch!,
        graphDir,
      });
    } catch {
      // No .whygraph/graph/ — skip
    }
  }

  return results;
}
