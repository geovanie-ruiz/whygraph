import { describe, it, expect, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../App";
import { wsClient } from "../lib/graphql.js";

// Dispose the graphql-ws client after all tests so the worker process exits
// cleanly. Without this, graphql-ws keeps async promise chains alive that
// prevent @vitest/coverage-v8 from flushing coverage data.
afterAll(() => wsClient.dispose());

describe("App", () => {
  it("renders the app title", () => {
    render(<App />);
    expect(screen.getByText("whygraph")).toBeDefined();
  });

  it("renders graph view SVG", () => {
    const { container } = render(<App />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("shows entity count", () => {
    render(<App />);
    expect(screen.getByText("Entities:")).toBeDefined();
  });
});
