import { createContext, useContext } from "react";

/**
 * Minimal entity type matching the GraphQL union Entity = StructuralNode | DecisionNode.
 * Both variants share these fields.
 */
export interface EntityBase {
  id: string;
  label: string;
  status: string;
  created_at: string;
  updated_at: string;
  removed_at?: string | null;
}

export interface StructuralNodeEntity extends EntityBase {
  name: string;
  parent?: string | null;
  description?: string | null;
  refs?: Array<{ file: string; symbol?: string | null }> | null;
}

export interface DecisionNodeEntity extends EntityBase {
  title: string;
  date: string;
  affects: string[];
  tags: string[];
  supersedes?: string | null;
  context: string;
  decision: string;
  tradeoffs: string;
  alternatives: string;
}

export type Entity = StructuralNodeEntity | DecisionNodeEntity;

export type EntityChangeType = "CREATED" | "UPDATED" | "DELETED" | "INITIAL_SNAPSHOT";

export interface EntityChangeEvent {
  type: EntityChangeType;
  entities?: Entity[] | null;
  entity?: Entity | null;
  entityId?: string | null;
}

/**
 * Apply an EntityChangeEvent to the entity map, returning a new map if changed.
 */
export function applyEvent(
  current: Map<string, Entity>,
  event: EntityChangeEvent,
): Map<string, Entity> {
  switch (event.type) {
    case "INITIAL_SNAPSHOT": {
      const next = new Map<string, Entity>();
      if (event.entities) {
        for (const entity of event.entities) {
          next.set(entity.id, entity);
        }
      }
      return next;
    }
    case "CREATED":
    case "UPDATED": {
      if (event.entity) {
        const next = new Map(current);
        next.set(event.entity.id, event.entity);
        return next;
      }
      return current;
    }
    case "DELETED": {
      if (event.entityId) {
        const next = new Map(current);
        next.delete(event.entityId);
        return next;
      }
      return current;
    }
    default:
      return current;
  }
}

export const ENTITY_CHANGED_SUBSCRIPTION = `
  subscription EntityChanged($includeInitial: Boolean) {
    entityChanged(includeInitial: $includeInitial) {
      type
      entityId
      entities {
        __typename
        ... on StructuralNode {
          id
          label
          name
          status
          parent
          description
          created_at
          updated_at
          removed_at
        }
        ... on DecisionNode {
          id
          label
          title
          status
          date
          affects
          tags
          supersedes
          context
          decision
          tradeoffs
          alternatives
          created_at
          updated_at
          removed_at
        }
      }
      entity {
        __typename
        ... on StructuralNode {
          id
          label
          name
          status
          parent
          description
          created_at
          updated_at
          removed_at
        }
        ... on DecisionNode {
          id
          label
          title
          status
          date
          affects
          tags
          supersedes
          context
          decision
          tradeoffs
          alternatives
          created_at
          updated_at
          removed_at
        }
      }
    }
  }
`;

export interface EntityStoreState {
  entities: Map<string, Entity>;
  connected: boolean;
}

export const EntityStoreContext = createContext<EntityStoreState>({
  entities: new Map(),
  connected: false,
});

export function useEntityStore(): EntityStoreState {
  return useContext(EntityStoreContext);
}
