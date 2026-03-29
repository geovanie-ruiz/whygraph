import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Environment, WhygraphConfig } from "../entity/types.js";
import { DECISION_TAGS } from "../entity/types.js";

export interface PlatformRulesResult {
  environment: Environment;
  filePath: string;
  mcpRegistered: boolean;
  mcpSetupPath?: string;
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
    "### MCP Server (preferred)",
    "",
    `Use the \`whygraph\` MCP server for decision capture tools when available.`,
    "",
    "### Direct File Write (fallback)",
    "",
    "If the MCP server is unreachable or MCP is blocked by your environment,",
    "write the decision file directly to `.whygraph/graph/` using the format above.",
    "The file will be picked up automatically on next server start.",
    "",
    "### Server Status",
    "",
    "Run `npx whygraph status` to check if the server is running.",
    "Run `npx whygraph up` to start the server.",
    "",
  ].join("\n");
}

function upsertMarkedSection(existing: string, content: string): string {
  const wrapped = `${START_MARKER}\n${content}${END_MARKER}\n`;

  if (existing.includes(START_MARKER)) {
    const startIdx = existing.indexOf(START_MARKER);
    const endIdx = existing.indexOf(END_MARKER);
    /* v8 ignore next 1 */
    const afterEnd = endIdx >= 0 ? endIdx + END_MARKER.length + 1 : existing.length;
    return existing.slice(0, startIdx) + wrapped + existing.slice(afterEnd);
  }

  /* v8 ignore next 1 */
  const sep = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  return existing + sep + wrapped;
}

// ============================================================
// MCP Registration
// ============================================================

function registerMcpWithClaude(projectDir: string): boolean {
  try {
    execSync("claude mcp add --scope project whygraph -- npx whygraph mcp", {
      cwd: projectDir,
      stdio: "ignore",
    });
    return true;
  /* v8 ignore start */
  } catch {
    // claude CLI not available — write .mcp.json directly as fallback
    try {
      const mcpJsonPath = join(projectDir, ".mcp.json");
      let mcpJson: Record<string, unknown> = {};
      if (existsSync(mcpJsonPath)) {
        mcpJson = JSON.parse(readFileSync(mcpJsonPath, "utf-8")) as Record<string, unknown>;
      }
      const servers = (mcpJson.mcpServers ?? {}) as Record<string, unknown>;
      if (!servers.whygraph) {
        servers.whygraph = { type: "stdio", command: "npx", args: ["whygraph", "mcp"] };
        mcpJson.mcpServers = servers;
        writeFileSync(mcpJsonPath, JSON.stringify(mcpJson, null, 2) + "\n", "utf-8");
      }
      return true;
    } catch {
      return false;
    }
  }
  /* v8 ignore stop */
}

function registerMcpWithCursor(projectDir: string): boolean {
  try {
    const cursorDir = join(projectDir, ".cursor");
    mkdirSync(cursorDir, { recursive: true });
    const mcpPath = join(cursorDir, "mcp.json");
    let mcp: Record<string, unknown> = {};
    if (existsSync(mcpPath)) {
      mcp = JSON.parse(readFileSync(mcpPath, "utf-8")) as Record<string, unknown>;
    }
    const servers = (mcp.mcpServers ?? {}) as Record<string, unknown>;
    if (!servers.whygraph) {
      servers.whygraph = { command: "npx", args: ["whygraph", "mcp"] };
      mcp.mcpServers = servers;
      writeFileSync(mcpPath, JSON.stringify(mcp, null, 2) + "\n", "utf-8");
    }
    return true;
  } catch {
    return false;
  }
}

function registerMcpWithCopilot(projectDir: string): boolean {
  try {
    const vscodeDir = join(projectDir, ".vscode");
    mkdirSync(vscodeDir, { recursive: true });
    const mcpPath = join(vscodeDir, "mcp.json");
    let mcp: Record<string, unknown> = {};
    if (existsSync(mcpPath)) {
      mcp = JSON.parse(readFileSync(mcpPath, "utf-8")) as Record<string, unknown>;
    }
    const servers = (mcp.servers ?? {}) as Record<string, unknown>;
    if (!servers.whygraph) {
      servers.whygraph = { type: "stdio", command: "npx", args: ["whygraph", "mcp"] };
      mcp.servers = servers;
      writeFileSync(mcpPath, JSON.stringify(mcp, null, 2) + "\n", "utf-8");
    }
    return true;
  } catch {
    return false;
  }
}

function writeMcpSetupMd(projectDir: string, environment: Environment): string {
  const whygraphDir = join(projectDir, ".whygraph");
  mkdirSync(whygraphDir, { recursive: true });
  const filePath = join(whygraphDir, "MCP_SETUP.md");

  const lines: string[] = ["# Whygraph MCP Setup", ""];

  switch (environment) {
    case "claude-code":
      lines.push(
        "Run the following command in your project root:",
        "",
        "```bash",
        "claude mcp add --scope project whygraph -- npx whygraph mcp",
        "```",
      );
      break;
    case "cursor":
      lines.push(
        "Add the following to `.cursor/mcp.json` in your project root:",
        "",
        "```json",
        JSON.stringify(
          { mcpServers: { whygraph: { command: "npx", args: ["whygraph", "mcp"] } } },
          null,
          2,
        ),
        "```",
      );
      break;
    case "copilot":
      lines.push(
        "Add the following to `.vscode/mcp.json` in your project root:",
        "",
        "```json",
        JSON.stringify(
          { servers: { whygraph: { type: "stdio", command: "npx", args: ["whygraph", "mcp"] } } },
          null,
          2,
        ),
        "```",
      );
      break;
    default:
      lines.push(
        "Add the whygraph MCP server to your AI assistant's MCP configuration.",
        "",
        "**Command:** `npx whygraph mcp`",
        "**Transport:** stdio",
        "",
        "Refer to your AI assistant's documentation for how to register MCP servers.",
      );
  }

  writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");
  return filePath;
}

// ============================================================
// Platform Writers
// ============================================================

export function writePlatformRules(
  projectDir: string,
  environment: Environment,
  _primeOutput: string,
  config?: WhygraphConfig,
): PlatformRulesResult {
  const instructions = config ? generateInstructions(config) : _primeOutput;

  switch (environment) {
    case "claude-code":
      return writeClaudeCodeRules(projectDir, instructions);
    case "cursor": {
      const mcpRegistered = registerMcpWithCursor(projectDir);
      const mcpSetupPath = mcpRegistered ? undefined : writeMcpSetupMd(projectDir, environment);
      return { ...writeAgentsMd(projectDir, instructions, environment), mcpRegistered, mcpSetupPath };
    }
    case "copilot": {
      const mcpRegistered = registerMcpWithCopilot(projectDir);
      const mcpSetupPath = mcpRegistered ? undefined : writeMcpSetupMd(projectDir, environment);
      return { ...writeCopilotInstructions(projectDir, instructions), mcpRegistered, mcpSetupPath };
    }
    case "other": {
      const mcpSetupPath = writeMcpSetupMd(projectDir, environment);
      return { ...writeAgentsMd(projectDir, instructions, environment), mcpRegistered: false, mcpSetupPath };
    }
  }
}

function writeClaudeCodeRules(
  projectDir: string,
  instructions: string,
): PlatformRulesResult {
  const mcpRegistered = registerMcpWithClaude(projectDir);
  const mcpSetupPath = mcpRegistered ? undefined : writeMcpSetupMd(projectDir, "claude-code");

  const claudeMdPath = join(projectDir, "CLAUDE.md");
  let existing = "";
  if (existsSync(claudeMdPath)) {
    existing = readFileSync(claudeMdPath, "utf-8");
  }

  const newContent = upsertMarkedSection(existing, instructions);
  writeFileSync(claudeMdPath, newContent, "utf-8");

  return { environment: "claude-code", filePath: claudeMdPath, mcpRegistered, mcpSetupPath };
}

function writeAgentsMd(
  projectDir: string,
  instructions: string,
  environment: Environment,
): Omit<PlatformRulesResult, "mcpRegistered" | "mcpSetupPath"> {
  const filePath = join(projectDir, "AGENTS.md");

  let existing = "";
  if (existsSync(filePath)) {
    existing = readFileSync(filePath, "utf-8");
  }

  const newContent = upsertMarkedSection(existing, instructions);
  writeFileSync(filePath, newContent, "utf-8");

  return { environment, filePath };
}

function writeCopilotInstructions(
  projectDir: string,
  instructions: string,
): Omit<PlatformRulesResult, "mcpRegistered" | "mcpSetupPath"> {
  const githubDir = join(projectDir, ".github");
  if (!existsSync(githubDir)) {
    mkdirSync(githubDir, { recursive: true });
  }

  const filePath = join(githubDir, "copilot-instructions.md");

  let existing = "";
  if (existsSync(filePath)) {
    existing = readFileSync(filePath, "utf-8");
  }

  const newContent = upsertMarkedSection(existing, instructions);
  writeFileSync(filePath, newContent, "utf-8");

  return { environment: "copilot", filePath };
}
