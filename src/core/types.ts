// ============================================================
// Node Types
// ============================================================

export type NodeLabel = "App" | "Feature" | "Component" | "Decision";
export type EdgeLabel = "COMPOSES" | "AFFECTS" | "SUPERSEDES" | "DEPRECATES";
export type DecisionStatus = "active" | "superseded";
export type StructuralStatus = "active" | "deprecated";
export type DecisionTag =
  | "arch"
  | "data"
  | "security"
  | "performance"
  | "integration"
  | "infra"
  | "ux";

export interface SymbolRef {
  file: string;
  symbol?: string;
}

export interface NodeProperties {
  name: string;
  description?: string;
  refs?: SymbolRef[];
  status?: StructuralStatus;
}

export interface DecisionProperties {
  title: string;
  date: string;
  context: string;
  decision: string;
  tradeoffs: string;
  alternatives: string;
  status: DecisionStatus;
  affects: string[];
  tags: DecisionTag[];
  supersedes?: string;
}

// ============================================================
// Event Types
// ============================================================

export interface NodeAddedEvent {
  type: "node_added";
  timestamp: string;
  id: string;
  label: NodeLabel;
  properties: NodeProperties | DecisionProperties;
}

export interface EdgeAddedEvent {
  type: "edge_added";
  timestamp: string;
  id: string;
  label: EdgeLabel;
  from: string;
  to: string;
}

export interface NodePatchedEvent {
  type: "node_patched";
  timestamp: string;
  id: string;
  properties: Partial<NodeProperties> | Partial<DecisionProperties>;
}

export interface EdgeRemovedEvent {
  type: "edge_removed";
  timestamp: string;
  id: string;
}

export interface NodeRemovedEvent {
  type: "node_removed";
  timestamp: string;
  id: string;
}

export type WhyEvent =
  | NodeAddedEvent
  | EdgeAddedEvent
  | NodePatchedEvent
  | EdgeRemovedEvent
  | NodeRemovedEvent;

// ============================================================
// Graph Attributes (stored on graphology nodes/edges)
// ============================================================

export interface GraphNodeAttributes extends NodeProperties {
  label: NodeLabel;
}

export interface GraphDecisionAttributes extends DecisionProperties {
  label: "Decision";
}

export interface GraphEdgeAttributes {
  label: EdgeLabel;
}

// ============================================================
// Query Results
// ============================================================

export interface ContextResult {
  nodes: Array<{
    id: string;
    label: NodeLabel;
    name: string;
    parentChain: string[];
  }>;
  decisions: Array<{
    id: string;
    attributes: DecisionProperties;
  }>;
}

export interface DecisionChain {
  decisionId: string;
  supersededBy?: string;
  supersedes?: string;
}

// ============================================================
// Config
// ============================================================

export type Environment = "claude-code" | "cursor" | "copilot" | "other";
export type SyncTrigger = "hook" | "git-hook" | "manual";
export type ContextInjection = "always" | "ask" | "never";
export type AutonomyLevel = "full" | "supervised" | "manual";

export interface WhygraphConfig {
  appName: string;
  environment: Environment;
  syncTrigger: SyncTrigger;
  contextInjection: ContextInjection;
  autonomy: AutonomyLevel;
}

// ============================================================
// Staging Entry Types
// ============================================================

export interface FeatureEntry {
  type: "feature";
  timestamp?: string;
  alias?: string;
  name: string;
  description?: string;
  refs?: SymbolRef[];
}

export interface ComponentEntry {
  type: "component";
  timestamp?: string;
  alias?: string;
  name: string;
  parent: string;
  description?: string;
  refs?: SymbolRef[];
}

export interface RefUpdateEntry {
  type: "ref-update";
  timestamp?: string;
  nodeId: string;
  add?: SymbolRef[];
  remove?: SymbolRef[];
}

export interface PatchEntry {
  type: "patch";
  timestamp?: string;
  nodeId: string;
  properties: Record<string, unknown>;
}

export interface DeprecateEntry {
  type: "deprecate";
  timestamp?: string;
  oldNodeId: string;
  newNodeId: string;
}

export interface DecisionEntry {
  type: "decision";
  timestamp?: string;
  name: string;
  context: string;
  decision: string;
  tradeoffs: string;
  alternatives: string;
  filesTouched?: string[];
  affects?: string[];
  tags: DecisionTag[];
  supersedes?: string;
  date?: string;
}

export interface ResolveReviewEntry {
  type: "resolve-review";
  timestamp?: string;
  reviewId: string;
  action: "supersede" | "dismiss";
}

export interface NodeRemovedEntry {
  type: "node-removed";
  timestamp?: string;
  nodeId: string;
}

export type StagingEntry =
  | FeatureEntry
  | ComponentEntry
  | RefUpdateEntry
  | PatchEntry
  | DeprecateEntry
  | DecisionEntry
  | ResolveReviewEntry
  | NodeRemovedEntry;

// ============================================================
// Review and Error Types
// ============================================================

export interface ReviewEntry {
  id: string;
  newDecisionId: string;
  existingDecisionId: string;
  sharedNodeIds: string[];
  status: "pending";
}

export interface ErrorEntry {
  entry: string;
  error: string;
  file: string;
}

// ============================================================
// Session Types
// ============================================================

export interface Session {
  id: string;
  startedAt: string;
  platform: Environment;
}

export interface SessionsFile {
  active: Session[];
}

// ============================================================
// Viz Types
// ============================================================

export interface VizNode {
  id: string;
  label: NodeLabel;
  [key: string]: unknown;
}

export interface VizEdge {
  id: string;
  label: EdgeLabel;
  from: string;
  to: string;
}

export interface VizSnapshot {
  timestamp: string;
  graph: {
    nodes: VizNode[];
    edges: VizEdge[];
  };
}

// ============================================================
// Processing Result
// ============================================================

export interface ProcessResult {
  eventsAppended: number;
  errorsFound: number;
  reviewsCreated: number;
  filesProcessed: number;
}
