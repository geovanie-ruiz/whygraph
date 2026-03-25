import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Environment, WhygraphConfig } from "../entity/types.js";
import { DECISION_TAGS } from "../entity/types.js";

export interface PlatformRulesResult {
  environment: Environment;
  filePath: string;
}

const START_MARKER = "<!-- whygraph:start -->";
const END_MARKER = "<!-- whygraph:end -->";

function generateInstructions(config: WhygraphConfig): string {
  const tagList = config.tags.join(", ");

  return [
    "## Whygraph — Decision Capture",
    "",
    "Before writing, modifying, or deleting production code, capture any non-trivial",
    "decision as a Decision node. A decision is non-trivial if a junior engineer would",
    "benefit from knowing why the choice was made.",
    "",
    "### Recognition Heuristic",
    "",
    "Scan your output for these signals:",
    "- Choosing between alternatives",
    "- Rejecting an approach",
    "- Setting a convention or pattern",
    "- Adding, removing, or changing a dependency",
    "- Configuring infrastructure or deployment",
    "- Making a security or performance tradeoff",
    "- Altering user-facing behavior",
    "- Scoping to production code the agent authored",
    "- Establishing an invariant or constraint",
    "",
    "### Decision File Format",
    "",
    "Write decision files to `.whygraph/graph/` with YAML frontmatter:",
    "",
    "```yaml",
    "---",
    `id: ${config.prefix}<4-char-nanoid>`,
    "label: Decision",
    "title: <short title>",
    "status: active",
    "date: <YYYY-MM-DD>",
    "affects:",
    "  - <entity-id>",
    "tags:",
    `  - <one of: ${tagList}>`,
    `created_at: <ISO 8601>`,
    `updated_at: <ISO 8601>`,
    "---",
    "",
    "## Context",
    "<why this decision was needed>",
    "",
    "## Decision",
    "<what was decided>",
    "",
    "## Tradeoffs",
    "<what was gained and lost>",
    "",
    "## Alternatives",
    "<what was considered and rejected>",
    "```",
    "",
    `Allowed tags: ${tagList}`,
    "",
    "### MCP Server",
    "",
    `Use the \`whygraph\` MCP server for decision capture tools.`,
    "If the server is unreachable, write decision files directly to `.whygraph/graph/`.",
    "",
    "### Server Status",
    "",
    "Run `whygraph status` to check if the server is running.",
    "Run `whygraph up` to start the server.",
    "",
  ].join("\n");
}

function upsertMarkedSection(existing: string, content: string): string {
  const wrapped = `${START_MARKER}\n${content}${END_MARKER}\n`;

  if (existing.includes(START_MARKER)) {
    const startIdx = existing.indexOf(START_MARKER);
    const endIdx = existing.indexOf(END_MARKER);
    const afterEnd = endIdx >= 0 ? endIdx + END_MARKER.length + 1 : existing.length;
    return existing.slice(0, startIdx) + wrapped + existing.slice(afterEnd);
  }

  const sep = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  return existing + sep + wrapped;
}

export function writePlatformRules(
  projectDir: string,
  environment: Environment,
  _primeOutput: string,
  config?: WhygraphConfig,
): PlatformRulesResult {
  const instructions = config ? generateInstructions(config) : _primeOutput;

  switch (environment) {
    case "claude-code":
      return writeClaudeCodeRules(projectDir, instructions, config);
    case "cursor":
      return writeAgentsMd(projectDir, instructions, "cursor");
    case "copilot":
      return writeAgentsMd(projectDir, instructions, "copilot");
    case "other":
      return writeAgentsMd(projectDir, instructions, "other");
  }
}

function writeClaudeCodeRules(
  projectDir: string,
  instructions: string,
  config?: WhygraphConfig,
): PlatformRulesResult {
  // Register MCP server in .claude/settings.json
  const settingsPath = join(projectDir, ".claude", "settings.json");
  const settingsDir = dirname(settingsPath);
  mkdirSync(settingsDir, { recursive: true });

  let settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    const raw = readFileSync(settingsPath, "utf-8");
    settings = JSON.parse(raw) as Record<string, unknown>;
  }

  const mcpServers = (settings.mcpServers ?? {}) as Record<string, unknown>;
  if (!mcpServers.whygraph) {
    mcpServers.whygraph = {
      command: "whygraph",
      args: ["mcp"],
    };
    settings.mcpServers = mcpServers;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  }

  // Write instructions to CLAUDE.md
  const claudeMdPath = join(projectDir, "CLAUDE.md");
  let existing = "";
  if (existsSync(claudeMdPath)) {
    existing = readFileSync(claudeMdPath, "utf-8");
  }

  const newContent = upsertMarkedSection(existing, instructions);
  writeFileSync(claudeMdPath, newContent, "utf-8");

  return { environment: "claude-code", filePath: claudeMdPath };
}

function writeAgentsMd(
  projectDir: string,
  instructions: string,
  environment: Environment,
): PlatformRulesResult {
  const filePath = join(projectDir, "AGENTS.md");

  let existing = "";
  if (existsSync(filePath)) {
    existing = readFileSync(filePath, "utf-8");
  }

  const newContent = upsertMarkedSection(existing, instructions);
  writeFileSync(filePath, newContent, "utf-8");

  return { environment, filePath };
}
