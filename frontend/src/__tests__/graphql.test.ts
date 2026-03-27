import { describe, it, expect } from "vitest";
import { urqlClient, wsClient } from "../lib/graphql.js";

describe("urql client", () => {
  it("is exported and configured", () => {
    expect(urqlClient).toBeDefined();
    // Client should have the standard urql methods
    expect(typeof urqlClient.query).toBe("function");
    expect(typeof urqlClient.mutation).toBe("function");
    expect(typeof urqlClient.subscription).toBe("function");
  });
});

describe("wsClient", () => {
  it("is exported with a subscribe method", () => {
    expect(wsClient).toBeDefined();
    expect(typeof wsClient.subscribe).toBe("function");
  });

  it("is exported with a dispose method", () => {
    expect(typeof wsClient.dispose).toBe("function");
  });
});

describe("forwardSubscription", () => {
  it("pipes subscriptions through wsClient without throwing", () => {
    const query = "subscription { entityChanged { type } }";
    const source = urqlClient.subscription(query, {});

    // Subscribe to the wonka source to trigger forwardSubscription.
    // The mock WebSocket in test-setup closes with 4400, so no data arrives,
    // but this exercises the subscribe → wsClient.subscribe plumbing.
    const results: unknown[] = [];
    const { unsubscribe } = source.subscribe((result) => {
      results.push(result);
    });

    // Clean up to avoid leaks.
    unsubscribe();

    // Reaching here without throwing confirms the forwardSubscription plumbing works.
    expect(typeof unsubscribe).toBe("function");
  });
});
