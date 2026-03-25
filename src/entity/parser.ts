import matter from "gray-matter";
import type {
  Entity,
  StructuralNode,
  DecisionNode,
  StructuralLabel,
  StructuralStatus,
  DecisionStatus,
  DecisionTag,
  SymbolRef,
} from "./types.js";
import { DECISION_TAGS } from "./types.js";

const STRUCTURAL_LABELS = new Set<string>(["App", "Feature", "Component"]);

/**
 * Parse markdown body into named sections keyed by ## headings.
 * Returns a map of heading name (lowercase) -> trimmed content.
 */
function parseSections(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = body.split("\n");
  let currentKey: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^## (.+)$/);
    if (headingMatch) {
      if (currentKey !== null) {
        sections.set(currentKey, currentLines.join("\n").trim());
      }
      currentKey = headingMatch[1].trim().toLowerCase();
      currentLines = [];
    } else if (currentKey !== null) {
      currentLines.push(line);
    }
  }

  if (currentKey !== null) {
    sections.set(currentKey, currentLines.join("\n").trim());
  }

  return sections;
}

function isValidStructuralLabel(label: string): label is StructuralLabel {
  return STRUCTURAL_LABELS.has(label);
}



function parseStructuralNode(
  data: Record<string, unknown>,
  body: string,
): StructuralNode | null {
  const { id, label, name, status, created_at, updated_at } = data;

  if (
    typeof id !== "string" ||
    typeof label !== "string" ||
    typeof name !== "string" ||
    typeof status !== "string" ||
    typeof created_at !== "string" &&
      !(created_at instanceof Date) ||
    typeof updated_at !== "string" &&
      !(updated_at instanceof Date)
  ) {
    return null;
  }

  if (!isValidStructuralLabel(label)) return null;
  if (status !== "active" && status !== "deprecated") return null;

  const node: StructuralNode = {
    id,
    label,
    name,
    status: status as StructuralStatus,
    created_at: String(created_at),
    updated_at: String(updated_at),
  };

  if (typeof data.parent === "string") {
    node.parent = data.parent;
  }

  if (Array.isArray(data.refs)) {
    const refs: SymbolRef[] = [];
    for (const ref of data.refs) {
      if (typeof ref === "object" && ref !== null && typeof ref.file === "string") {
        const symbolRef: SymbolRef = { file: ref.file };
        if (typeof ref.symbol === "string") {
          symbolRef.symbol = ref.symbol;
        }
        refs.push(symbolRef);
      }
    }
    if (refs.length > 0) {
      node.refs = refs;
    }
  }

  if (typeof data.description === "string") {
    node.description = data.description;
  } else {
    const trimmed = body.trim();
    if (trimmed.length > 0) {
      node.description = trimmed;
    }
  }

  if (typeof data.removed_at === "string" || data.removed_at instanceof Date) {
    node.removed_at = String(data.removed_at);
  }

  return node;
}

function parseDecisionNode(
  data: Record<string, unknown>,
  body: string,
): DecisionNode | null {
  const { id, title, status, date, affects, tags, created_at, updated_at } = data;

  if (
    typeof id !== "string" ||
    typeof title !== "string" ||
    typeof status !== "string" ||
    (typeof date !== "string" && !(date instanceof Date)) ||
    !Array.isArray(affects) ||
    !Array.isArray(tags) ||
    (typeof created_at !== "string" && !(created_at instanceof Date)) ||
    (typeof updated_at !== "string" && !(updated_at instanceof Date))
  ) {
    return null;
  }

  if (status !== "active" && status !== "superseded") return null;

  const validAffects = affects.filter((a): a is string => typeof a === "string");
  const rawTags = tags.filter((t): t is string => typeof t === "string");

  const sections = parseSections(body);

  const node: DecisionNode = {
    id,
    label: "Decision",
    title,
    status: status as DecisionStatus,
    date: String(date),
    affects: validAffects,
    tags: rawTags as DecisionTag[],
    context: sections.get("context") ?? "",
    decision: sections.get("decision") ?? "",
    tradeoffs: sections.get("tradeoffs") ?? "",
    alternatives: sections.get("alternatives") ?? "",
    created_at: String(created_at),
    updated_at: String(updated_at),
  };

  if (typeof data.supersedes === "string") {
    node.supersedes = data.supersedes;
  }

  if (typeof data.removed_at === "string" || data.removed_at instanceof Date) {
    node.removed_at = String(data.removed_at);
  }

  return node;
}

/**
 * Parse a markdown string with YAML front matter into a typed Entity object.
 * Returns null for unparseable content.
 */
export function parseEntity(content: string): Entity | null {
  if (!content || !content.trim()) return null;

  try {
    const { data, content: body } = matter(content);

    if (!data || typeof data !== "object" || !data.label) return null;

    const label = data.label as string;

    if (label === "Decision") {
      return parseDecisionNode(data as Record<string, unknown>, body);
    }

    if (isValidStructuralLabel(label)) {
      return parseStructuralNode(data as Record<string, unknown>, body);
    }

    return null;
  } catch {
    return null;
  }
}
