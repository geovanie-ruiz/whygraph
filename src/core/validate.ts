import type {
  WhyEvent,
  NodeLabel,
  NodeAddedEvent,
  EdgeAddedEvent,
  NodePatchedEvent,
  DecisionProperties,
} from "./types.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ValidationContext {
  nodeLabels?: Map<string, NodeLabel>;
}

// 8-4-4-4-12 lowercase hex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ISO 8601 datetime: YYYY-MM-DDTHH:MM:SS[.sss](Z|+HH:MM|-HH:MM)
const ISO_8601_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// YYYY-MM-DD
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const DECISION_REQUIRED_STRING_FIELDS: (keyof DecisionProperties)[] = [
  "title",
  "date",
  "context",
  "decision",
  "tradeoffs",
  "alternatives",
];

const KNOWN_DECISION_PROPERTIES = new Set<string>([
  "title",
  "date",
  "context",
  "decision",
  "tradeoffs",
  "alternatives",
  "status",
  "affects",
  "supersedes",
  "name",
  "description",
]);

// Properties that node_patched is NOT allowed to set
const PATCH_FORBIDDEN = new Set(["affects", "label"]);

// All known patchable properties (Decision + Node)
const KNOWN_PATCHABLE = new Set([
  "title",
  "date",
  "context",
  "decision",
  "tradeoffs",
  "alternatives",
  "status",
  "supersedes",
  "name",
  "description",
]);

function isValidUuid(id: string): boolean {
  return UUID_RE.test(id);
}

function isValidEdgeId(id: string): boolean {
  if (!id.startsWith("edge-")) return false;
  return isValidUuid(id.slice(5));
}

function isValidTimestamp(ts: string): boolean {
  return ISO_8601_RE.test(ts);
}

function validateTimestamp(ts: string, errors: string[]): void {
  if (!isValidTimestamp(ts)) {
    errors.push(`Invalid timestamp: must be ISO 8601 datetime, got "${ts}"`);
  }
}

function validateNodeId(id: string, errors: string[], fieldName: string): void {
  if (!isValidUuid(id)) {
    errors.push(`Invalid ${fieldName}: must be a valid UUID (8-4-4-4-12 hex), got "${id}"`);
  }
}

function validateNodeAdded(event: NodeAddedEvent, errors: string[]): void {
  validateNodeId(event.id, errors, "node ID");
  validateTimestamp(event.timestamp, errors);

  if (event.label === "Decision") {
    const props = event.properties as Partial<DecisionProperties>;

    // Check required string fields present and non-empty
    for (const field of DECISION_REQUIRED_STRING_FIELDS) {
      const val = props[field];
      if (val === undefined || val === null) {
        errors.push(`Decision missing required field: ${field}`);
      } else if (typeof val === "string" && val.trim() === "") {
        errors.push(`Decision field "${field}" must not be empty`);
      }
    }

    // Check status
    if (props.status === undefined || props.status === null) {
      errors.push("Decision missing required field: status");
    }

    // Check affects
    if (!props.affects) {
      errors.push("Decision missing required field: affects");
    } else if (!Array.isArray(props.affects) || props.affects.length === 0) {
      errors.push("Decision field \"affects\" must be a non-empty array");
    }

    // Validate date format
    if (typeof props.date === "string" && props.date.trim() !== "" && !DATE_RE.test(props.date)) {
      errors.push(`Decision date must be YYYY-MM-DD format, got "${props.date}"`);
    }
  }
}

function validateEdgeAdded(
  event: EdgeAddedEvent,
  errors: string[],
  context?: ValidationContext,
): void {
  if (!isValidEdgeId(event.id)) {
    errors.push(`Invalid edge ID: must be "edge-" prefix + valid UUID, got "${event.id}"`);
  }
  validateTimestamp(event.timestamp, errors);
  validateNodeId(event.from, errors, "from");
  validateNodeId(event.to, errors, "to");

  // Edge hierarchy checks require context
  if (context?.nodeLabels) {
    const fromLabel = context.nodeLabels.get(event.from);
    const toLabel = context.nodeLabels.get(event.to);

    if (fromLabel && toLabel) {
      validateEdgeHierarchy(event.label, fromLabel, toLabel, errors);
    }
  }
}

function validateEdgeHierarchy(
  edgeLabel: string,
  fromLabel: NodeLabel,
  toLabel: NodeLabel,
  errors: string[],
): void {
  switch (edgeLabel) {
    case "COMPOSES": {
      const validFrom = ["App", "Feature", "Component"];
      const validTo = ["Feature", "Component"];
      if (!validFrom.includes(fromLabel)) {
        errors.push(
          `COMPOSES: from must be App/Feature/Component, got "${fromLabel}"`,
        );
      }
      if (!validTo.includes(toLabel)) {
        errors.push(
          `COMPOSES: to must be Feature/Component, got "${toLabel}"`,
        );
      }
      break;
    }
    case "AFFECTS": {
      if (fromLabel !== "Decision") {
        errors.push(`AFFECTS: from must be Decision, got "${fromLabel}"`);
      }
      break;
    }
    case "SUPERSEDES": {
      if (fromLabel !== "Decision") {
        errors.push(`SUPERSEDES: from must be Decision, got "${fromLabel}"`);
      }
      if (toLabel !== "Decision") {
        errors.push(`SUPERSEDES: to must be Decision, got "${toLabel}"`);
      }
      break;
    }
    case "DEPRECATES": {
      if (fromLabel !== toLabel) {
        errors.push(
          `DEPRECATES: from and to must be same node type, got "${fromLabel}" -> "${toLabel}"`,
        );
      }
      break;
    }
  }
}

function validateNodePatched(event: NodePatchedEvent, errors: string[]): void {
  validateNodeId(event.id, errors, "node ID");
  validateTimestamp(event.timestamp, errors);

  const props = event.properties as Record<string, unknown>;
  for (const key of Object.keys(props)) {
    if (PATCH_FORBIDDEN.has(key)) {
      errors.push(
        `node_patched cannot modify "${key}" — managed by edges/node creation`,
      );
    } else if (!KNOWN_PATCHABLE.has(key)) {
      errors.push(`node_patched: unknown property "${key}"`);
    }
  }
}

function validateEdgeRemoved(event: { type: string; timestamp: string; id: string }, errors: string[]): void {
  if (!isValidEdgeId(event.id)) {
    errors.push(`Invalid edge ID: must be "edge-" prefix + valid UUID, got "${event.id}"`);
  }
  validateTimestamp(event.timestamp, errors);
}

function validateNodeRemoved(event: { type: string; timestamp: string; id: string }, errors: string[]): void {
  validateNodeId(event.id, errors, "node ID");
  validateTimestamp(event.timestamp, errors);
}

export function validateEvent(
  event: WhyEvent,
  context?: ValidationContext,
): ValidationResult {
  const errors: string[] = [];

  switch (event.type) {
    case "node_added":
      validateNodeAdded(event, errors);
      break;
    case "edge_added":
      validateEdgeAdded(event, errors, context);
      break;
    case "node_patched":
      validateNodePatched(event, errors);
      break;
    case "edge_removed":
      validateEdgeRemoved(event, errors);
      break;
    case "node_removed":
      validateNodeRemoved(event, errors);
      break;
  }

  return { valid: errors.length === 0, errors };
}
