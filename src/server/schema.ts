import * as path from "node:path";
import { createSchema, createPubSub } from "graphql-yoga";
import type { ServerCore } from "./core.js";
import { isStructuralNode, isDecisionNode } from "../entity/types.js";
import type {
  Entity,
  StructuralNode,
  DecisionNode,
  StructuralLabel,
  DecisionStatus,
  DecisionTag,
  SymbolRef,
} from "../entity/types.js";
import { generateId } from "../entity/id.js";
import { writeEntity } from "../entity/writer.js";
import { getContext } from "../graph/query.js";
import { getDecisions } from "../graph/decisions.js";
import type { DecisionFilters } from "../graph/decisions.js";
import { getGaps } from "../graph/gaps.js";
import { listNodes } from "../graph/nodes.js";
import type { NodeFilters } from "../graph/nodes.js";
import { searchDecisions } from "../graph/search.js";
import { computeDerivedState } from "./derived.js";

const typeDefs = /* GraphQL */ `
  type StructuralNode {
    id: ID!
    label: String!
    name: String!
    status: String!
    parent: String
    refs: [SymbolRef!]
    description: String
    created_at: String!
    updated_at: String!
    removed_at: String
  }

  type DecisionNode {
    id: ID!
    label: String!
    title: String!
    status: String!
    date: String!
    affects: [String!]!
    tags: [String!]!
    supersedes: String
    context: String!
    decision: String!
    tradeoffs: String!
    alternatives: String!
    created_at: String!
    updated_at: String!
    removed_at: String
  }

  type SymbolRef {
    file: String!
    symbol: String
  }

  input SymbolRefInput {
    file: String!
    symbol: String
  }

  union Entity = StructuralNode | DecisionNode

  type ContextNodeResult {
    id: ID!
    label: String!
    name: String!
    parentChain: [String!]!
  }

  type ContextDecisionResult {
    id: ID!
    attributes: String!
  }

  type ContextResult {
    nodes: [ContextNodeResult!]!
    decisions: [ContextDecisionResult!]!
  }

  type NodeSummary {
    id: ID!
    label: String!
    name: String!
    parent: String
  }

  type ValidationErrorEntry {
    field: String!
    message: String!
    severity: String!
  }

  type EntityValidationError {
    entityId: ID!
    errors: [ValidationErrorEntry!]!
  }

  type SupersedeCandidate {
    newDecisionId: ID!
    existingDecisionId: ID!
    sharedNodeIds: [String!]!
  }

  type Query {
    entities: [Entity!]!
    entity(id: ID!): Entity
    status: ServerStatus!
    context(file: String!, symbol: String): ContextResult!
    decisions(status: String, tags: [String!], dateFrom: String, dateTo: String): [DecisionNode!]!
    gaps(limit: Int): [StructuralNode!]!
    nodes(label: String, parent: String, search: String): [NodeSummary!]!
    search(query: String!): [DecisionNode!]!
    validationErrors: [EntityValidationError!]!
    supersedeCandidates: [SupersedeCandidate!]!
  }

  type ServerStatus {
    running: Boolean!
    entityCount: Int!
    nodeCount: Int!
    decisionCount: Int!
  }

  type Mutation {
    ping: Boolean!
    createNode(
      label: String!
      name: String!
      parent: String
      refs: [SymbolRefInput!]
      description: String
    ): StructuralNode!
    createDecision(
      title: String!
      date: String!
      affects: [String!]!
      tags: [String!]!
      context: String!
      decision: String!
      tradeoffs: String!
      alternatives: String!
      supersedes: String
    ): DecisionNode!
    updateEntity(
      id: ID!
      status: String
      removed_at: String
      refs: [SymbolRefInput!]
    ): Entity!
  }

  enum EntityChangeType {
    CREATED
    UPDATED
    DELETED
    INITIAL_SNAPSHOT
  }

  type EntityChangeEvent {
    type: EntityChangeType!
    entities: [Entity!]
    entity: Entity
    entityId: String
  }

  type Subscription {
    entityChanged(includeInitial: Boolean): EntityChangeEvent!
  }
`;

interface CreateNodeArgs {
  label: string;
  name: string;
  parent?: string;
  refs?: SymbolRef[];
  description?: string;
}

interface CreateDecisionArgs {
  title: string;
  date: string;
  affects: string[];
  tags: string[];
  context: string;
  decision: string;
  tradeoffs: string;
  alternatives: string;
  supersedes?: string;
}

interface UpdateEntityArgs {
  id: string;
  status?: string;
  removed_at?: string;
  refs?: SymbolRef[];
}

interface EntityChangeEvent {
  type: "CREATED" | "UPDATED" | "DELETED" | "INITIAL_SNAPSHOT";
  entities?: Entity[];
  entity?: Entity;
  entityId?: string;
}

export function buildSchema(core: ServerCore) {
  const yogaPubSub = createPubSub<{ entityChanged: [EntityChangeEvent] }>();

  // Wire ServerCore's PubSub to Yoga's PubSub for subscriptions
  core.pubsub.subscribe((event) => {
    if (event.type === "entity_created") {
      yogaPubSub.publish("entityChanged", {
        type: "CREATED",
        entity: event.entity,
        entityId: event.entityId,
      });
    } else if (event.type === "entity_updated") {
      yogaPubSub.publish("entityChanged", {
        type: "UPDATED",
        entity: event.entity,
        entityId: event.entityId,
      });
    } else if (event.type === "entity_deleted") {
      yogaPubSub.publish("entityChanged", {
        type: "DELETED",
        entityId: event.entityId,
      });
    }
  });

  return createSchema({
    typeDefs,
    resolvers: {
      Entity: {
        __resolveType(obj: Entity) {
          if (isDecisionNode(obj)) return "DecisionNode";
          return "StructuralNode";
        },
      },
      Query: {
        entities: () => core.getAllEntities(),
        entity: (_: unknown, args: { id: string }) => core.getEntity(args.id) ?? null,
        status: () => {
          const all = core.getAllEntities();
          const decisions = all.filter(isDecisionNode);
          const nodes = all.filter(isStructuralNode);
          return {
            running: true,
            entityCount: all.length,
            nodeCount: nodes.length,
            decisionCount: decisions.length,
          };
        },
        context: (_: unknown, args: { file: string; symbol?: string }) => {
          const result = getContext(core.getGraph(), args.file, args.symbol ?? undefined);
          return {
            nodes: result.nodes,
            decisions: result.decisions.map((d) => ({
              id: d.id,
              attributes: JSON.stringify(d.attributes),
            })),
          };
        },
        decisions: (_: unknown, args: { status?: string; tags?: string[]; dateFrom?: string; dateTo?: string }) => {
          const filters: DecisionFilters = {};
          if (args.status !== undefined && args.status !== null) {
            filters.status = args.status as DecisionStatus;
          }
          if (args.tags !== undefined && args.tags !== null) {
            filters.tags = args.tags as DecisionTag[];
          }
          if (args.dateFrom !== undefined && args.dateFrom !== null) {
            filters.dateFrom = args.dateFrom;
          }
          if (args.dateTo !== undefined && args.dateTo !== null) {
            filters.dateTo = args.dateTo;
          }
          return getDecisions(core.getGraph(), filters);
        },
        gaps: (_: unknown, args: { limit?: number }) => {
          return getGaps(core.getGraph(), args.limit ?? undefined);
        },
        nodes: (_: unknown, args: { label?: string; parent?: string; search?: string }) => {
          const filters: NodeFilters = {};
          if (args.label !== undefined && args.label !== null) {
            filters.label = args.label as NodeFilters["label"];
          }
          if (args.parent !== undefined && args.parent !== null) {
            filters.parent = args.parent;
          }
          if (args.search !== undefined && args.search !== null) {
            filters.search = args.search;
          }
          return listNodes(core.getGraph(), filters);
        },
        search: (_: unknown, args: { query: string }) => {
          return searchDecisions(core.getEntityMap(), args.query);
        },
        validationErrors: () => {
          const derived = computeDerivedState(core.getEntityMap());
          const results: Array<{ entityId: string; errors: Array<{ field: string; message: string; severity: string }> }> = [];
          for (const [entityId, errors] of derived.validationErrors) {
            results.push({ entityId, errors });
          }
          return results;
        },
        supersedeCandidates: () => {
          const derived = computeDerivedState(core.getEntityMap());
          return derived.supersedeCandidates;
        },
      },
      Mutation: {
        ping: () => true,

        createNode: (_: unknown, args: CreateNodeArgs) => {
          const now = new Date().toISOString();
          const id = generateId();
          const graphDir = path.join(core.getWhygraphDir(), "graph");

          const node: StructuralNode = {
            id,
            label: args.label as StructuralLabel,
            name: args.name,
            status: "active",
            created_at: now,
            updated_at: now,
          };

          if (args.parent !== undefined) node.parent = args.parent;
          if (args.refs !== undefined) node.refs = args.refs;
          if (args.description !== undefined) node.description = args.description;

          writeEntity(graphDir, node);
          core.addOrUpdateEntity(id, node);

          return node;
        },

        createDecision: (_: unknown, args: CreateDecisionArgs) => {
          const now = new Date().toISOString();
          const id = generateId();
          const graphDir = path.join(core.getWhygraphDir(), "graph");

          const decision: DecisionNode = {
            id,
            label: "Decision",
            title: args.title,
            status: "active",
            date: args.date,
            affects: args.affects,
            tags: args.tags as DecisionTag[],
            context: args.context,
            decision: args.decision,
            tradeoffs: args.tradeoffs,
            alternatives: args.alternatives,
            created_at: now,
            updated_at: now,
          };

          if (args.supersedes !== undefined) decision.supersedes = args.supersedes;

          writeEntity(graphDir, decision);
          core.addOrUpdateEntity(id, decision);

          return decision;
        },

        updateEntity: (_: unknown, args: UpdateEntityArgs) => {
          const existing = core.getEntity(args.id);
          if (!existing) {
            throw new Error(`Entity not found: ${args.id}`);
          }

          const now = new Date().toISOString();
          const graphDir = path.join(core.getWhygraphDir(), "graph");

          const updated = { ...existing, updated_at: now };

          if (args.status !== undefined) {
            (updated as Record<string, unknown>).status = args.status;
          }
          if (args.removed_at !== undefined) {
            updated.removed_at = args.removed_at;
          }
          if (args.refs !== undefined && isStructuralNode(updated)) {
            updated.refs = args.refs;
          }

          writeEntity(graphDir, updated);
          core.addOrUpdateEntity(args.id, updated);

          return updated;
        },
      },
      Subscription: {
        entityChanged: {
          subscribe: (_: unknown, args: { includeInitial?: boolean }) => {
            const baseIterator = yogaPubSub.subscribe("entityChanged");

            if (!args.includeInitial) {
              return baseIterator;
            }

            // Wrap with initial snapshot
            async function* withInitialSnapshot() {
              const allEntities = core.getAllEntities();
              yield {
                entityChanged: {
                  type: "INITIAL_SNAPSHOT" as const,
                  entities: allEntities,
                },
              };

              for await (const event of baseIterator) {
                yield event;
              }
            }

            return withInitialSnapshot();
          },
          resolve: (event: { entityChanged: EntityChangeEvent } | EntityChangeEvent) => {
            // Events from yogaPubSub come wrapped, initial snapshot comes unwrapped
            if ("entityChanged" in event) {
              return event.entityChanged;
            }
            return event;
          },
        },
      },
    },
  });
}
