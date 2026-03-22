import type {
  StagingEntry,
  FeatureEntry,
  ComponentEntry,
  DecisionEntry,
  RefUpdateEntry,
  PatchEntry,
  DeprecateEntry,
  ResolveReviewEntry,
  NodeRemovedEntry,
  SymbolRef,
  DecisionTag,
} from "../core/types.js";

const KNOWN_TYPES = new Set([
  "feature",
  "component",
  "ref-update",
  "patch",
  "deprecate",
  "decision",
  "resolve-review",
  "node-removed",
]);

// Keys that start a new field (not continuation of previous field).
// For [patch] entries, any key:value line is a property, so we handle that specially.
const KNOWN_KEYS =
  /^(timestamp|date|context|decision|tradeoffs|alternatives|files-touched|affects|tags|supersedes|alias|parent|description|refs|add|remove|action):\s?(.*)/;

const HEADING_RE = /^## \[(\S+)\] (.+)$/;
const REF_ITEM_RE = /^\s+-\s+file:\s+(.+)$/;

function parseRefItem(line: string): SymbolRef | null {
  const match = line.match(REF_ITEM_RE);
  if (!match) return null;

  const rest = match[1].trim();
  const symbolMatch = rest.match(/^(.+?),\s*symbol:\s*(.+)$/);
  if (symbolMatch) {
    return { file: symbolMatch[1].trim(), symbol: symbolMatch[2].trim() };
  }
  return { file: rest };
}

function splitCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

interface RawFields {
  [key: string]: string | SymbolRef[];
}

function buildEntry(
  entryType: string,
  heading: string,
  fields: RawFields
): StagingEntry | null {
  const timestamp =
    typeof fields["timestamp"] === "string" ? fields["timestamp"] : undefined;

  switch (entryType) {
    case "feature": {
      const entry: FeatureEntry = {
        type: "feature",
        name: heading,
      };
      if (timestamp) entry.timestamp = timestamp;
      if (typeof fields["alias"] === "string") entry.alias = fields["alias"];
      if (typeof fields["description"] === "string")
        entry.description = fields["description"];
      if (Array.isArray(fields["refs"]))
        entry.refs = fields["refs"] as SymbolRef[];
      return entry;
    }

    case "component": {
      const entry: ComponentEntry = {
        type: "component",
        name: heading,
        parent: typeof fields["parent"] === "string" ? fields["parent"] : "",
      };
      if (timestamp) entry.timestamp = timestamp;
      if (typeof fields["alias"] === "string") entry.alias = fields["alias"];
      if (typeof fields["description"] === "string")
        entry.description = fields["description"];
      if (Array.isArray(fields["refs"]))
        entry.refs = fields["refs"] as SymbolRef[];
      return entry;
    }

    case "ref-update": {
      const entry: RefUpdateEntry = {
        type: "ref-update",
        nodeId: heading,
      };
      if (timestamp) entry.timestamp = timestamp;
      if (Array.isArray(fields["add"]))
        entry.add = fields["add"] as SymbolRef[];
      if (Array.isArray(fields["remove"]))
        entry.remove = fields["remove"] as SymbolRef[];
      return entry;
    }

    case "patch": {
      const properties: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (key === "timestamp") continue;
        if (typeof value === "string") {
          properties[key] = value;
        }
      }
      const entry: PatchEntry = {
        type: "patch",
        nodeId: heading,
        properties,
      };
      if (timestamp) entry.timestamp = timestamp;
      return entry;
    }

    case "deprecate": {
      const parts = heading.split(/\s+/);
      const entry: DeprecateEntry = {
        type: "deprecate",
        oldNodeId: parts[0],
        newNodeId: parts[1] || "",
      };
      if (timestamp) entry.timestamp = timestamp;
      return entry;
    }

    case "decision": {
      const entry: DecisionEntry = {
        type: "decision",
        name: heading,
        context: typeof fields["context"] === "string" ? fields["context"] : "",
        decision:
          typeof fields["decision"] === "string" ? fields["decision"] : "",
        tradeoffs:
          typeof fields["tradeoffs"] === "string" ? fields["tradeoffs"] : "",
        alternatives:
          typeof fields["alternatives"] === "string"
            ? fields["alternatives"]
            : "",
        tags:
          typeof fields["tags"] === "string"
            ? (splitCommaSeparated(fields["tags"]) as DecisionTag[])
            : [],
      };
      if (timestamp) entry.timestamp = timestamp;
      if (typeof fields["date"] === "string") entry.date = fields["date"];
      if (typeof fields["supersedes"] === "string")
        entry.supersedes = fields["supersedes"];
      if (typeof fields["files-touched"] === "string")
        entry.filesTouched = splitCommaSeparated(fields["files-touched"]);
      if (typeof fields["affects"] === "string")
        entry.affects = splitCommaSeparated(fields["affects"]);
      return entry;
    }

    case "resolve-review": {
      const entry: ResolveReviewEntry = {
        type: "resolve-review",
        reviewId: heading,
        action:
          typeof fields["action"] === "string"
            ? (fields["action"] as "supersede" | "dismiss")
            : "dismiss",
      };
      if (timestamp) entry.timestamp = timestamp;
      return entry;
    }

    case "node-removed": {
      const entry: NodeRemovedEntry = {
        type: "node-removed",
        nodeId: heading,
      };
      if (timestamp) entry.timestamp = timestamp;
      return entry;
    }

    default:
      return null;
  }
}

export function parseEntries(content: string): StagingEntry[] {
  if (!content.trim()) return [];

  const lines = content.split("\n");
  const entries: StagingEntry[] = [];

  let currentType: string | null = null;
  let currentHeading: string = "";
  let currentFields: RawFields = {};
  let currentKey: string | null = null;
  // For ref-like fields (refs, add, remove), we accumulate SymbolRef arrays
  let currentRefList: SymbolRef[] | null = null;

  function finalizeEntry() {
    if (currentType === null) return;

    // Finalize any pending ref list
    if (currentKey && currentRefList && currentRefList.length > 0) {
      currentFields[currentKey] = currentRefList;
    }

    if (KNOWN_TYPES.has(currentType)) {
      const entry = buildEntry(currentType, currentHeading, currentFields);
      if (entry) entries.push(entry);
    }
  }

  for (const line of lines) {
    // Check for heading
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      // Finalize previous entry
      finalizeEntry();

      currentType = headingMatch[1];
      currentHeading = headingMatch[2];
      currentFields = {};
      currentKey = null;
      currentRefList = null;
      continue;
    }

    // Skip lines before the first heading
    if (currentType === null) continue;

    // Check for ref item (must come before key check since "- file:" lines
    // could theoretically match a key pattern)
    const refItem = parseRefItem(line);
    if (refItem && currentRefList !== null) {
      currentRefList.push(refItem);
      continue;
    }

    // Check for known key (or any key:value for patch entries)
    const keyMatch = line.match(KNOWN_KEYS);
    if (keyMatch) {
      // Finalize any pending ref list before starting a new field
      if (currentKey && currentRefList && currentRefList.length > 0) {
        currentFields[currentKey] = currentRefList;
        currentRefList = null;
      }

      const key = keyMatch[1];
      const value = keyMatch[2].trim();

      // refs, add, remove start ref-list accumulation
      if (key === "refs" || key === "add" || key === "remove") {
        currentKey = key;
        currentRefList = [];
        continue;
      }

      currentKey = key;
      currentFields[key] = value;
      continue;
    }

    // For patch entries, any key: value line is a property
    if (currentType === "patch") {
      const patchKeyMatch = line.match(/^(\S[\w-]*\S?):\s?(.*)/);
      if (patchKeyMatch) {
        if (currentKey && currentRefList && currentRefList.length > 0) {
          currentFields[currentKey] = currentRefList;
          currentRefList = null;
        }
        currentKey = patchKeyMatch[1];
        currentFields[patchKeyMatch[1]] = patchKeyMatch[2].trim();
        continue;
      }
    }

    // Continuation line: append to current string field
    const trimmed = line.trim();
    if (trimmed && currentKey && typeof currentFields[currentKey] === "string") {
      currentFields[currentKey] = currentFields[currentKey] + " " + trimmed;
    }
  }

  // Finalize the last entry
  finalizeEntry();

  return entries;
}
