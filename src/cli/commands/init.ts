import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import prompts from "prompts";
import { appendEvent, getEventsFilePath } from "../../core/events.js";
import type {
  WhygraphConfig,
  Environment,
  SyncTrigger,
  ContextInjection,
  AutonomyLevel,
  NodeAddedEvent,
} from "../../core/types.js";

export interface InitAnswers {
  appName: string;
  environment: Environment;
  syncTrigger: SyncTrigger;
  contextInjection: ContextInjection;
  autonomy: AutonomyLevel;
}

export interface InitResult {
  created: string[];
  repaired: string[];
  skipped: string[];
}

const GITIGNORE_CONTENT = `staging/
sessions.json
errors.jsonl
.lock
.sessions-lock
`;

interface FileSpec {
  relativePath: string;
  isDir: boolean;
  content?: () => string;
}

function buildFileSpecs(answers: InitAnswers): FileSpec[] {
  const config: WhygraphConfig = {
    appName: answers.appName,
    environment: answers.environment,
    syncTrigger: answers.syncTrigger,
    contextInjection: answers.contextInjection,
    autonomy: answers.autonomy,
  };

  return [
    { relativePath: "staging", isDir: true },
    { relativePath: "viz", isDir: true },
    {
      relativePath: "config.json",
      isDir: false,
      content: () => JSON.stringify(config, null, 2) + "\n",
    },
    {
      relativePath: "sessions.json",
      isDir: false,
      content: () => JSON.stringify({ active: [] }, null, 2) + "\n",
    },
    { relativePath: "reviews.jsonl", isDir: false, content: () => "" },
    { relativePath: "errors.jsonl", isDir: false, content: () => "" },
    { relativePath: ".gitignore", isDir: false, content: () => GITIGNORE_CONTENT },
  ];
}

/**
 * Core init logic, separated from prompts for testability.
 * Returns a structured result suitable for --json output.
 */
export async function runInit(
  rootDir: string,
  answers: InitAnswers,
): Promise<InitResult> {
  const whygraphDir = path.join(rootDir, ".whygraph");
  const result: InitResult = { created: [], repaired: [], skipped: [] };

  // Ensure .whygraph directory exists
  fs.mkdirSync(whygraphDir, { recursive: true });

  // Handle events.jsonl specially — never overwrite
  const eventsPath = getEventsFilePath(rootDir);
  if (!fs.existsSync(eventsPath)) {
    fs.writeFileSync(eventsPath, "", "utf-8");

    const appEvent: NodeAddedEvent = {
      type: "node_added",
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID(),
      label: "App",
      properties: { name: answers.appName },
    };
    appendEvent(eventsPath, appEvent);
    result.created.push("events.jsonl");
  } else {
    result.skipped.push("events.jsonl");
  }

  // Process all other file specs
  const specs = buildFileSpecs(answers);
  for (const spec of specs) {
    const fullPath = path.join(whygraphDir, spec.relativePath);
    const exists = fs.existsSync(fullPath);

    if (exists) {
      result.skipped.push(spec.relativePath);
      continue;
    }

    if (spec.isDir) {
      fs.mkdirSync(fullPath, { recursive: true });
    } else {
      fs.writeFileSync(fullPath, spec.content!(), "utf-8");
    }

    // If .whygraph already existed before this run, this is a repair
    const isRepair = result.skipped.length > 0 || result.created.includes("events.jsonl") === false;
    if (isRepair && result.skipped.length > 0) {
      result.repaired.push(spec.relativePath);
    } else {
      result.created.push(spec.relativePath);
    }
  }

  return result;
}

/**
 * Prompt the user for init configuration.
 */
export async function promptForAnswers(): Promise<InitAnswers | null> {
  const response = await prompts(
    [
      {
        type: "text",
        name: "appName",
        message: "Project name",
        initial: path.basename(process.cwd()),
      },
      {
        type: "select",
        name: "environment",
        message: "Development environment",
        choices: [
          { title: "Claude Code", value: "claude-code" },
          { title: "Cursor", value: "cursor" },
          { title: "Copilot", value: "copilot" },
          { title: "Other", value: "other" },
        ],
      },
      {
        type: "select",
        name: "syncTrigger",
        message: "How should decisions sync to the graph?",
        choices: [
          { title: "Hook (automatic on tool call)", value: "hook" },
          { title: "Git hook (on commit)", value: "git-hook" },
          { title: "Manual (run whygraph sync)", value: "manual" },
        ],
      },
      {
        type: "select",
        name: "contextInjection",
        message: "Inject decision context into agent prompts?",
        choices: [
          { title: "Always", value: "always" },
          { title: "Ask each time", value: "ask" },
          { title: "Never", value: "never" },
        ],
      },
      {
        type: "select",
        name: "autonomy",
        message: "Agent autonomy level for graph modifications?",
        choices: [
          { title: "Full (auto-capture decisions)", value: "full" },
          { title: "Supervised (suggest, human approves)", value: "supervised" },
          { title: "Manual (human drives all changes)", value: "manual" },
        ],
      },
    ],
    { onCancel: () => null },
  );

  // prompts returns {} if cancelled
  if (!response.appName) return null;

  return response as InitAnswers;
}

/**
 * Print human-readable next steps.
 */
export function printNextSteps(result: InitResult, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }

  if (result.created.length > 0) {
    console.log("\nCreated:");
    for (const f of result.created) {
      console.log(`  + .whygraph/${f}`);
    }
  }

  if (result.repaired.length > 0) {
    console.log("\nRepaired:");
    for (const f of result.repaired) {
      console.log(`  ~ .whygraph/${f}`);
    }
  }

  if (result.skipped.length > 0) {
    console.log("\nAlready existed (skipped):");
    for (const f of result.skipped) {
      console.log(`  - .whygraph/${f}`);
    }
  }

  console.log("\nNext steps:");
  console.log("  1. Run `whygraph prime` to see decision capture instructions");
  console.log("  2. Add .whygraph/ to your project's version control");
  console.log("  3. Start coding — whygraph will capture your architectural decisions");
  console.log("");
}
