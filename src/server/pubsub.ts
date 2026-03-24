import type { Entity } from "../entity/types.js";

export interface GraphEvent {
  type:
    | "entity_created"
    | "entity_updated"
    | "entity_deleted"
    | "graph_changed";
  entityId?: string;
  entity?: Entity;
}

export type Subscriber = (event: GraphEvent) => void;

export class PubSub {
  private subscribers: Set<Subscriber> = new Set();

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  publish(event: GraphEvent): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch {
        // Non-blocking: errors in one subscriber must not affect others
      }
    }
  }
}
