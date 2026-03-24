import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Environment } from "../entity/types.js";

// ============================================================
// Types
// ============================================================

export interface PlatformRulesResult {
  environment: Environment;
  filePath: string;
}

// ============================================================
// Core Logic
// ============================================================

export function writePlatformRules(
  projectDir: string,
  environment: Environment,
  primeOutput: string,
): PlatformRulesResult {
  switch (environment) {
    case "claude-code":
      return writeClaudeCodeRules(projectDir, primeOutput);
    case "cursor":
      return writeCursorRules(projectDir, primeOutput);
    case "copilot":
      return writeCopilotRules(projectDir, primeOutput);
    case "other":
      return writeOtherRules(projectDir, primeOutput);
  }
}

// ============================================================
// Platform Writers
// ============================================================

function writeClaudeCodeRules(
  projectDir: string,
  _primeOutput: string,
): PlatformRulesResult {
  const settingsPath = join(projectDir, ".claude", "settings.json");
  const dir = dirname(settingsPath);
  mkdirSync(dir, { recursive: true });

  let settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    const raw = readFileSync(settingsPath, "utf-8");
    settings = JSON.parse(raw) as Record<string, unknown>;
  }

  // Merge hooks — add whygraph prime to SessionStart
  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
  const sessionStart = (hooks.SessionStart ?? []) as Array<Record<string, unknown>>;

  const whygraphHook = {
    matcher: "",
    command: "whygraph prime",
  };

  // Only add if not already present
  const alreadyExists = sessionStart.some(
    (h) => h.command === "whygraph prime",
  );

  if (!alreadyExists) {
    sessionStart.push(whygraphHook);
  }

  hooks.SessionStart = sessionStart;
  settings.hooks = hooks;

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");

  return { environment: "claude-code", filePath: settingsPath };
}

function writeCursorRules(
  projectDir: string,
  primeOutput: string,
): PlatformRulesResult {
  const filePath = join(projectDir, ".cursor", "rules", "whygraph.md");
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, primeOutput, "utf-8");
  return { environment: "cursor", filePath };
}

function writeCopilotRules(
  projectDir: string,
  primeOutput: string,
): PlatformRulesResult {
  const filePath = join(projectDir, ".github", "copilot-instructions.md");
  mkdirSync(dirname(filePath), { recursive: true });

  let existing = "";
  if (existsSync(filePath)) {
    existing = readFileSync(filePath, "utf-8");
  }

  const marker = "<!-- whygraph:start -->";
  const endMarker = "<!-- whygraph:end -->";
  const wrappedContent = `${marker}\n${primeOutput}${endMarker}\n`;

  let newContent: string;
  if (existing.includes(marker)) {
    // Replace existing whygraph section
    const startIdx = existing.indexOf(marker);
    const endIdx = existing.indexOf(endMarker);
    const afterEnd = endIdx >= 0 ? endIdx + endMarker.length + 1 : existing.length;
    newContent = existing.slice(0, startIdx) + wrappedContent + existing.slice(afterEnd);
  } else {
    // Append
    newContent = existing + (existing.length > 0 && !existing.endsWith("\n") ? "\n" : "") + wrappedContent;
  }

  writeFileSync(filePath, newContent, "utf-8");
  return { environment: "copilot", filePath };
}

function writeOtherRules(
  projectDir: string,
  primeOutput: string,
): PlatformRulesResult {
  const filePath = join(projectDir, ".whygraph", "AGENT_CONTEXT.md");
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, primeOutput, "utf-8");
  return { environment: "other", filePath };
}
