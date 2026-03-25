import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import yaml from "js-yaml";
import type { WhygraphConfig } from "../../entity/types.js";

// ============================================================
// Core Logic
// ============================================================

export function runPrime(whygraphDir: string): string {
  const configPath = join(whygraphDir, ".whygraph", "config.yaml");

  if (!existsSync(configPath)) {
    throw new Error(
      `.whygraph/ not found in ${whygraphDir}. Run "whygraph init" first.`,
    );
  }

  const raw = readFileSync(configPath, "utf-8");
  const config = yaml.load(raw) as WhygraphConfig;

  const lines: string[] = [
    `# Whygraph Agent Instructions — ${config.appName}`,
    "",
    "## Decision Capture Directive",
    "",
    "Before writing, modifying, or deleting production code, you MUST capture",
    "any non-trivial decision as a Decision node in the whygraph. A decision is",
    "non-trivial if a junior engineer would benefit from knowing why the choice",
    "was made. Categories: arch, data, security, performance, integration, infra, ux.",
    "",
    "## File Format Reference",
    "",
    "Decision nodes are Markdown files with YAML frontmatter stored in",
    "`.whygraph/graph/`. Each file contains: id, label, title, status, date,",
    "affects, tags, context, decision, tradeoffs, and alternatives.",
    "",
    "## Recognition Heuristic",
    "",
    "Scan your own output for signals that a decision was made:",
    "- Choosing between alternatives",
    "- Rejecting an approach",
    "- Setting a convention or pattern",
    "- Adding, removing, or changing a dependency",
    "- Configuring infrastructure or deployment",
    "- Making a security or performance tradeoff",
    "- Altering user-facing behavior",
    "- Scoping to production code the agent authored",
    "",
    "## Server Verification Directive",
    "",
    `Verify the whygraph MCP server is running on port ${config.serverPort} before`,
    "performing graph mutations. If the server is not reachable, fall back to",
    "direct file writes in `.whygraph/graph/`.",
    "",
    "## Configuration",
    "",
    `- Prefix: ${config.prefix}`,
    `- Tags: ${config.tags.join(", ")}`,
    `- Environment: ${config.environment}`,
    `- MCP Mode: ${config.mcpMode}`,
  ];

  return lines.join("\n") + "\n";
}

// ============================================================
// CLI Wiring
// ============================================================

export function registerPrimeCommand(program: Command): void {
  program
    .command("prime")
    .description(
      "Generate agent instructions from whygraph configuration",
    )
    .option("--json", "Output results as JSON")
    .action((opts: { json?: boolean }) => {
      try {
        const output = runPrime(process.cwd());

        if (opts.json) {
          process.stdout.write(
            JSON.stringify({ output }, null, 2) + "\n",
          );
        } else {
          process.stdout.write(output);
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
