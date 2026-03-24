import { createSchema } from "graphql-yoga";
import type { ServerCore } from "./core.js";
import { isStructuralNode, isDecisionNode } from "../entity/types.js";
import type { Entity } from "../entity/types.js";

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

  type Query {
    entities: [Entity!]!
    entity(id: ID!): Entity
    status: ServerStatus!
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
      },
      Mutation: {
        ping: () => true,
      },
    },
  });
}
