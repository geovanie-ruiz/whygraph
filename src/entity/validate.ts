import {
  DECISION_TAGS,
  isStructuralNode,
  isDecisionNode,
} from "./types.js";
import type { Entity, DecisionTag } from "./types.js";

// ============================================================
// Cross-reference Validation
// ============================================================

export function validateEntityRefs(entity: Entity, entityMap: Map<string, Entity>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (isDecisionNode(entity)) {
    for (const ref of entity.affects) {
      if (!entityMap.has(ref)) {
        errors.push({
          field: "affects",
          message: `affects ref "${ref}" does not exist in the graph`,
          severity: "warning",
        });
      }
    }
    if (entity.supersedes && !entityMap.has(entity.supersedes)) {
      errors.push({
        field: "supersedes",
        message: `supersedes ref "${entity.supersedes}" does not exist in the graph`,
        severity: "warning",
      });
    }
  }

  if (isStructuralNode(entity) && entity.parent && !entityMap.has(entity.parent)) {
    errors.push({
      field: "parent",
      message: `parent ref "${entity.parent}" does not exist in the graph`,
      severity: "warning",
    });
  }

  return errors;
}

// ============================================================
// Validation Types
// ============================================================

export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================================
// Helpers
// ============================================================

const VALID_LABELS = ["App", "Feature", "Component", "Decision"] as const;
const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidISO8601(value: unknown): boolean {
  /* v8 ignore next 1 */
  if (typeof value !== "string") return false;
  return ISO_8601_RE.test(value);
}

function isValidDate(value: unknown): boolean {
  /* v8 ignore next 1 */
  if (typeof value !== "string") return false;
  return DATE_RE.test(value);
}

// ============================================================
// Validator
// ============================================================

export function validateEntity(entity: Entity): ValidationResult {
  const errors: ValidationError[] = [];

  // Common fields
  if (!isNonEmptyString(entity.id)) {
    errors.push({ field: "id", message: "id is required and must be a non-empty string", severity: "error" });
  }

  if (!(VALID_LABELS as readonly string[]).includes(entity.label)) {
    errors.push({ field: "label", message: `label must be one of: ${VALID_LABELS.join(", ")}`, severity: "error" });
  }

  if (!isValidISO8601(entity.created_at)) {
    errors.push({ field: "created_at", message: "created_at must be a valid ISO 8601 timestamp", severity: "error" });
  }

  if (!isValidISO8601(entity.updated_at)) {
    errors.push({ field: "updated_at", message: "updated_at must be a valid ISO 8601 timestamp", severity: "error" });
  }

  if (entity.removed_at !== undefined && !isValidISO8601(entity.removed_at)) {
    errors.push({ field: "removed_at", message: "removed_at must be a valid ISO 8601 timestamp", severity: "error" });
  }

  // Structural node validations
  if (isStructuralNode(entity)) {
    if (!isNonEmptyString(entity.name)) {
      errors.push({ field: "name", message: "name is required and must be a non-empty string", severity: "error" });
    }

    if (entity.status !== "active" && entity.status !== "deprecated") {
      errors.push({ field: "status", message: "structural node status must be \"active\" or \"deprecated\"", severity: "error" });
    }

    if (entity.parent !== undefined && !isNonEmptyString(entity.parent)) {
      errors.push({ field: "parent", message: "parent, if present, must be a non-empty string", severity: "error" });
    }

    if (entity.label === "App" && entity.parent !== undefined) {
      errors.push({ field: "parent", message: "App nodes should not have a parent", severity: "warning" });
    }

    if ((entity.label === "Feature" || entity.label === "Component") && entity.parent === undefined) {
      errors.push({ field: "parent", message: `${entity.label} nodes should have a parent`, severity: "warning" });
    }
  }

  // Decision node validations
  if (isDecisionNode(entity)) {
    if (!isNonEmptyString(entity.title)) {
      errors.push({ field: "title", message: "title is required and must be a non-empty string", severity: "error" });
    }

    if (entity.status !== "active" && entity.status !== "superseded") {
      errors.push({ field: "status", message: "decision node status must be \"active\" or \"superseded\"", severity: "error" });
    }

    if (!isValidDate(entity.date)) {
      errors.push({ field: "date", message: "date must match YYYY-MM-DD format", severity: "error" });
    }

    if (!Array.isArray(entity.affects) || entity.affects.length === 0) {
      errors.push({ field: "affects", message: "affects is required and must be a non-empty array", severity: "error" });
    }

    /* v8 ignore next 1 */
    if (Array.isArray(entity.tags)) {
      for (const tag of entity.tags) {
        if (!DECISION_TAGS.includes(tag as DecisionTag)) {
          errors.push({ field: "tags", message: `invalid tag "${tag}"; must be one of: ${DECISION_TAGS.join(", ")}`, severity: "error" });
        }
      }
    }

    if (!isNonEmptyString(entity.context)) {
      errors.push({ field: "context", message: "context is required and must be a non-empty string", severity: "error" });
    }

    if (!isNonEmptyString(entity.decision)) {
      errors.push({ field: "decision", message: "decision is required and must be a non-empty string", severity: "error" });
    }

    if (!isNonEmptyString(entity.tradeoffs)) {
      errors.push({ field: "tradeoffs", message: "tradeoffs is required and must be a non-empty string", severity: "error" });
    }

    if (!isNonEmptyString(entity.alternatives)) {
      errors.push({ field: "alternatives", message: "alternatives is required and must be a non-empty string", severity: "error" });
    }

    if (entity.supersedes !== undefined && !isNonEmptyString(entity.supersedes)) {
      errors.push({ field: "supersedes", message: "supersedes, if present, must be a non-empty string", severity: "error" });
    }
  }

  return {
    valid: errors.filter((e) => e.severity === "error").length === 0,
    errors,
  };
}
