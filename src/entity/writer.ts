import { writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { isStructuralNode, isDecisionNode } from "./types.js";
import type { Entity, StructuralNode, DecisionNode } from "./types.js";
import { toFilename } from "./id.js";

// ============================================================
// YAML front matter rendering
// ============================================================

/**
 * Quote a string value for YAML — wraps in double quotes if the value
 * contains characters that could cause YAML parsing issues.
 */
function yamlValue(value: string): string {
  // Always quote timestamps, dates, and values that look ambiguous
  if (
    /^\d/.test(value) ||
    /[:{}\[\],&*?|>!%#@`]/.test(value) ||
    value === "true" ||
    value === "false" ||
    value === "null" ||
    value === ""
  ) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

function renderFrontMatter(lines: string[]): string {
  return `---\n${lines.join("\n")}\n---`;
}

function renderStructuralFrontMatter(node: StructuralNode): string[] {
  const lines: string[] = [
    `id: ${node.id}`,
    `label: ${node.label}`,
    `name: ${yamlValue(node.name)}`,
    `status: ${node.status}`,
  ];

  if (node.parent !== undefined) {
    lines.push(`parent: ${node.parent}`);
  }

  if (node.refs !== undefined && node.refs.length > 0) {
    lines.push("refs:");
    for (const ref of node.refs) {
      if (ref.symbol !== undefined) {
        lines.push(`  - file: ${yamlValue(ref.file)}`);
        lines.push(`    symbol: ${yamlValue(ref.symbol)}`);
      } else {
        lines.push(`  - file: ${yamlValue(ref.file)}`);
      }
    }
  }

  if (node.description !== undefined) {
    lines.push(`description: ${yamlValue(node.description)}`);
  }

  lines.push(`created_at: ${yamlValue(node.created_at)}`);
  lines.push(`updated_at: ${yamlValue(node.updated_at)}`);

  if (node.removed_at !== undefined) {
    lines.push(`removed_at: ${yamlValue(node.removed_at)}`);
  }

  return lines;
}

function renderDecisionFrontMatter(node: DecisionNode): string[] {
  const lines: string[] = [
    `id: ${node.id}`,
    `label: Decision`,
    `title: ${yamlValue(node.title)}`,
    `status: ${node.status}`,
    `date: ${yamlValue(node.date)}`,
  ];

  lines.push("affects:");
  for (const a of node.affects) {
    lines.push(`  - ${a}`);
  }

  lines.push("tags:");
  for (const t of node.tags) {
    lines.push(`  - ${t}`);
  }

  if (node.supersedes !== undefined) {
    lines.push(`supersedes: ${node.supersedes}`);
  }

  lines.push(`created_at: ${yamlValue(node.created_at)}`);
  lines.push(`updated_at: ${yamlValue(node.updated_at)}`);

  if (node.removed_at !== undefined) {
    lines.push(`removed_at: ${yamlValue(node.removed_at)}`);
  }

  return lines;
}

// ============================================================
// Body rendering
// ============================================================

function renderStructuralBody(node: StructuralNode): string {
  if (node.description !== undefined) {
    return `\n${node.description}\n`;
  }
  return "\n";
}

function renderDecisionBody(node: DecisionNode): string {
  const sections = [
    { heading: "Context", content: node.context },
    { heading: "Decision", content: node.decision },
    { heading: "Tradeoffs", content: node.tradeoffs },
    { heading: "Alternatives", content: node.alternatives },
  ];

  const parts: string[] = [];
  for (const { heading, content } of sections) {
    parts.push(`## ${heading}\n\n${content}`);
  }

  return `\n${parts.join("\n\n")}\n`;
}

// ============================================================
// Public API
// ============================================================

/**
 * Pure function: render an Entity to a markdown string with YAML front matter.
 */
export function renderEntity(entity: Entity): string {
  if (isDecisionNode(entity)) {
    const fm = renderDecisionFrontMatter(entity);
    return renderFrontMatter(fm) + renderDecisionBody(entity);
  }

  // structural node — description goes in body, not front matter
  const node = entity as StructuralNode;
  const fmLines = renderStructuralFrontMatter(node);
  // Remove description from front matter — it goes in the body
  const fmWithoutDesc = fmLines.filter(
    (line) => !line.startsWith("description:"),
  );
  return renderFrontMatter(fmWithoutDesc) + renderStructuralBody(node);
}

/**
 * Write an entity to disk as a markdown file. Returns the file path written.
 * Uses atomic write (temp file + rename). Creates parent directories if needed.
 */
export function writeEntity(dirPath: string, entity: Entity): string {
  const titleOrName = isDecisionNode(entity) ? entity.title : entity.name;
  const filename = toFilename(entity.id, titleOrName);
  const filePath = join(dirPath, filename);
  const tempPath = filePath + ".tmp";

  mkdirSync(dirPath, { recursive: true });

  const content = renderEntity(entity);
  writeFileSync(tempPath, content, "utf-8");
  renameSync(tempPath, filePath);

  return filePath;
}
