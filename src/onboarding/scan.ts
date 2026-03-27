import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import type { SymbolRef } from "../entity/types.js";

// ============================================================
// Types
// ============================================================

export interface ScanProposal {
  features: Array<{ name: string; refs: SymbolRef[] }>;
  components: Array<{ name: string; parentFeature: string; refs: SymbolRef[] }>;
}

export interface ScanResult {
  proposal: ScanProposal;
  scannedDir: string;
}

// ============================================================
// Constants
// ============================================================

const MAIN_FILE_NAMES = new Set([
  "index.ts",
  "index.js",
  "index.tsx",
  "index.jsx",
  "mod.ts",
  "mod.js",
  "main.ts",
  "main.js",
]);

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".whygraph",
  "dist",
  "build",
  "coverage",
  "__pycache__",
  ".next",
  ".nuxt",
]);

// ============================================================
// Helpers
// ============================================================

function findSourceRoot(projectDir: string): string | null {
  const candidates = ["src", "lib", "app", "packages"];

  for (const candidate of candidates) {
    const candidatePath = join(projectDir, candidate);
    if (existsSync(candidatePath) && statSync(candidatePath).isDirectory()) {
      return candidatePath;
    }
  }

  return null;
}

function findMainFiles(dirPath: string, projectDir: string): SymbolRef[] {
  const refs: SymbolRef[] = [];

  /* v8 ignore next 1 */
  if (!existsSync(dirPath)) return refs;

  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    if (MAIN_FILE_NAMES.has(entry)) {
      const fullPath = join(dirPath, entry);
      if (statSync(fullPath).isFile()) {
        refs.push({ file: relative(projectDir, fullPath) });
      }
    }
  }

  return refs;
}

function getSubdirectories(dirPath: string): string[] {
  /* v8 ignore next 1 */
  if (!existsSync(dirPath)) return [];

  return readdirSync(dirPath).filter((entry) => {
    if (IGNORED_DIRS.has(entry)) return false;
    if (entry.startsWith(".")) return false;
    const fullPath = join(dirPath, entry);
    return statSync(fullPath).isDirectory();
  });
}

// ============================================================
// Core Logic
// ============================================================

export async function runScan(
  projectDir: string,
  _whygraphDir: string,
): Promise<ScanResult> {
  const sourceRoot = findSourceRoot(projectDir);

  if (sourceRoot === null) {
    return {
      proposal: { features: [], components: [] },
      scannedDir: projectDir,
    };
  }

  const features: ScanProposal["features"] = [];
  const components: ScanProposal["components"] = [];

  const topLevelDirs = getSubdirectories(sourceRoot);

  for (const dirName of topLevelDirs) {
    const dirPath = join(sourceRoot, dirName);
    const mainRefs = findMainFiles(dirPath, projectDir);

    features.push({
      name: dirName,
      refs: mainRefs,
    });

    // Look for subdirectories as components
    const subDirs = getSubdirectories(dirPath);
    for (const subDirName of subDirs) {
      const subDirPath = join(dirPath, subDirName);
      const subRefs = findMainFiles(subDirPath, projectDir);

      components.push({
        name: subDirName,
        parentFeature: dirName,
        refs: subRefs,
      });
    }
  }

  return {
    proposal: { features, components },
    scannedDir: sourceRoot,
  };
}
