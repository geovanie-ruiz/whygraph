import { describe, it, expect, vi } from "vitest";
import { PubSub } from "../../src/server/pubsub.js";
import type { GraphEvent } from "../../src/server/pubsub.js";

describe("PubSub", () => {
  it("publishes event to subscriber", () => {
    const pubsub = new PubSub();
    const callback = vi.fn();
    pubsub.subscribe(callback);

    const event: GraphEvent = { type: "entity_created", entityId: "wg-abc1" };
    pubsub.publish(event);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(event);
  });

  it("publishes event to multiple subscribers", () => {
    const pubsub = new PubSub();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();
    pubsub.subscribe(cb1);
    pubsub.subscribe(cb2);
    pubsub.subscribe(cb3);

    const event: GraphEvent = { type: "graph_changed" };
    pubsub.publish(event);

    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
    expect(cb3).toHaveBeenCalledOnce();
  });

  it("unsubscribe stops delivery", () => {
    const pubsub = new PubSub();
    const callback = vi.fn();
    const unsubscribe = pubsub.subscribe(callback);

    pubsub.publish({ type: "entity_created" });
    expect(callback).toHaveBeenCalledOnce();

    unsubscribe();

    pubsub.publish({ type: "entity_deleted" });
    expect(callback).toHaveBeenCalledOnce(); // still 1, not 2
  });

  it("callback error does not affect other subscribers", () => {
    const pubsub = new PubSub();
    const cb1 = vi.fn();
    const cb2 = vi.fn(() => {
      throw new Error("subscriber explosion");
    });
    const cb3 = vi.fn();

    pubsub.subscribe(cb1);
    pubsub.subscribe(cb2);
    pubsub.subscribe(cb3);

    const event: GraphEvent = { type: "entity_updated", entityId: "wg-xyz1" };
    pubsub.publish(event);

    expect(cb1).toHaveBeenCalledWith(event);
    expect(cb2).toHaveBeenCalledWith(event);
    expect(cb3).toHaveBeenCalledWith(event);
  });
});
