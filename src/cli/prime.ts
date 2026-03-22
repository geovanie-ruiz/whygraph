import * as fs from "node:fs";
import * as path from "node:path";

function findWhygraphDir(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, ".whygraph");
    if (fs.existsSync(path.join(candidate, "config.json"))) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function loadUuidMap(whygraphDir: string): Record<string, string> | null {
  const mapPath = path.join(whygraphDir, "uuid-map.json");
  try {
    return JSON.parse(fs.readFileSync(mapPath, "utf-8")) as Record<string, string>;
  } catch {
    return null;
  }
}

function formatUuidHints(uuidMap: Record<string, string>): string {
  const lines = Object.entries(uuidMap)
    .map(([name, uuid]) => `  ${name}: ${uuid}`)
    .join("\n");
  return `\nComponent UUIDs for affects field:\n${lines}\n`;
}

export function prime(startDir: string = process.cwd()): string {
  const whygraphDir = findWhygraphDir(startDir);

  let appName = "this project";
  if (whygraphDir) {
    try {
      const config = JSON.parse(
        fs.readFileSync(path.join(whygraphDir, "config.json"), "utf-8"),
      );
      if (config.appName) appName = config.appName;
    } catch {
      // use default
    }
  }

  const uuidMap = whygraphDir ? loadUuidMap(whygraphDir) : null;
  const uuidSection = uuidMap ? formatUuidHints(uuidMap) : "";

  return `# Whygraph — Decision Capture

${appName} tracks architectural decisions. Capture decisions in real-time as you work.

## What Is a Decision?

Any point where you:
1. **Chose between approaches** — even if one was clearly better
2. **Followed a convention** a future agent might not know
3. **Configured with specific values** that exclude alternatives
4. **Modeled data** in a specific way (types, required vs optional, unions vs interfaces)
5. **Chose NOT to do something** — deliberate omissions
6. **Invented something not in the spec** — scaffolding, helpers, workarounds

The most important decisions feel obvious. Capture those — a future agent won't know alternatives existed.

## When to Capture

Write each entry AS SOON AS you make the choice. Not at the end. The reasoning degrades within minutes.

## Staging Entry Format

Write to \`.whygraph/staging/<descriptive-name>.md\`:

\`\`\`markdown
## [decision] <concise title>
timestamp: <ISO 8601>
context: <the problem that created this fork — what pressure, not just the title restated>
decision: <what you chose and how>
tradeoffs: <what was gained AND what was lost — name the cost>
alternatives: <other approaches and WHY each was rejected>
affects: <UUID(s) from uuid-map, or use files-touched if unavailable>
files-touched: <file paths modified, if no UUIDs>
tags: <from: arch, data, security, performance, integration, infra, ux>
\`\`\`

## Staging File Naming

Use distinct names to avoid collisions with concurrent agents:
- If working on a tracked task: \`staging/<task-id>.md\`
- Otherwise: \`staging/<descriptive-slug>.md\`

Commit staging files before ending your session.
${uuidSection}`;
}

export function runPrime(): void {
  process.stdout.write(prime() + "\n");
}
