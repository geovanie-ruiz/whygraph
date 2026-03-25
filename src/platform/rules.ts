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
  // TODO(whygraph-imsm): rewrite to register MCP server in settings.json
  // and write minimal instructions to CLAUDE.md
  const filePath = join(projectDir, ".claude", "settings.json");
  return { environment: "claude-code", filePath };
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
