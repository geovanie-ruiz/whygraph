import { describe, it, expect } from "vitest";
import { urqlClient } from "../lib/graphql";

describe("urql client", () => {
  it("is exported and configured", () => {
    expect(urqlClient).toBeDefined();
    // Client should have the standard urql methods
    expect(typeof urqlClient.query).toBe("function");
    expect(typeof urqlClient.mutation).toBe("function");
    expect(typeof urqlClient.subscription).toBe("function");
  });
});
