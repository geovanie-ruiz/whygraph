// ============================================================
// Labels & Status
// ============================================================

export type StructuralLabel = "App" | "Feature" | "Component";
export type NodeLabel = StructuralLabel | "Decision";

export type StructuralStatus = "active" | "deprecated";
export type DecisionStatus = "active" | "superseded";

// ============================================================
// Tags (closed set)
// ============================================================

export type DecisionTag =
  | "arch"
  | "data"
  | "security"
  | "performance"
  | "integration"
  | "infra"
  | "ux";

export const DECISION_TAGS: readonly DecisionTag[] = [
  "arch",
  "data",
  "security",
  "performance",
  "integration",
  "infra",
  "ux",
] as const;

// ============================================================
// Edge Labels (derived, not stored)
// ============================================================

export type EdgeLabel = "COMPOSES" | "AFFECTS" | "SUPERSEDES";

// ============================================================
// Refs (code references on structural nodes)
// ============================================================

export interface SymbolRef {
  file: string;
  symbol?: string;
}

// ============================================================
// Entity Types
// ============================================================

export interface StructuralNode {
  id: string;
  label: StructuralLabel;
  name: string;
  status: StructuralStatus;
  parent?: string;
  refs?: SymbolRef[];
  description?: string;
  created_at: string;
  updated_at: string;
  removed_at?: string;
}

export interface DecisionNode {
  id: string;
  label: "Decision";
  title: string;
  status: DecisionStatus;
  date: string;
  affects: string[];
  tags: DecisionTag[];
  supersedes?: string;
  context: string;
  decision: string;
  tradeoffs: string;
  alternatives: string;
  created_at: string;
  updated_at: string;
  removed_at?: string;
}

export type Entity = StructuralNode | DecisionNode;

// ============================================================
// Type Guards
// ============================================================

export function isStructuralNode(entity: Entity): entity is StructuralNode {
  return entity.label !== "Decision";
}

export function isDecisionNode(entity: Entity): entity is DecisionNode {
  return entity.label === "Decision";
}

// ============================================================
// Config
// ============================================================

export type Environment = "claude-code" | "cursor" | "copilot" | "other";
export type MpcMode = "default" | "strict";

export interface WhygraphConfig {
  appName: string;
  environment: Environment;
  prefix: string;
  idLength: number;
  tags: DecisionTag[];
  mpcMode: MpcMode;
  serverPort: number;
}
