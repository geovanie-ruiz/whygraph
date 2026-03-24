import { createSchema } from "graphql-yoga";
import type { ServerCore } from "./core.js";
import { isStructuralNode, isDecisionNode } from "../entity/types.js";
import type { Entity, DecisionStatus, DecisionTag } from "../entity/types.js";
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
  }
`;

export function buildSchema(core: ServerCore) {
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
      },
    },
  });
}
