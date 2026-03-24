import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { GraphView } from "./GraphView.js";
import type { Entity } from "../lib/store.js";

function makeStructural(id: string, name: string, label = "Component"): Entity {
  return {
    id,
    label,
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    name,
    parent: null,
    description: null,
    refs: null,
  };
}

function makeDecision(id: string, title: string): Entity {
  return {
    id,
    label: "Decision",
    status: "accepted",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    title,
    date: "2025-01-01",
    affects: [],
    tags: [],
    supersedes: null,
    context: "some context",
    decision: "some decision",
    tradeoffs: "some tradeoffs",
    alternatives: "some alternatives",
  };
}

describe("GraphView", () => {
  it("renders an svg element", () => {
    const entities = new Map<string, Entity>();
    const { getByTestId } = render(
      <GraphView entities={entities} onSelect={vi.fn()} />,
    );
    expect(getByTestId("graph-view")).toBeTruthy();
  });

  it("re-renders when entity data changes (new props)", () => {
    const onSelect = vi.fn();
    const entities1 = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
    ]);

    const { rerender, getByTestId } = render(
      <GraphView entities={entities1} onSelect={onSelect} />,
    );

    const svg = getByTestId("graph-view");
    // After first render with one node, SVG should have content
    expect(svg.querySelectorAll("g").length).toBeGreaterThan(0);

    // Add a second entity and re-render
    const entities2 = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
      ["n2", makeDecision("d1", "Use JWT")],
    ]);

    rerender(<GraphView entities={entities2} onSelect={onSelect} />);

    // SVG should still have content after re-render
    expect(svg.querySelectorAll("g").length).toBeGreaterThan(0);
  });

  it("handles entity removal gracefully", () => {
    const onSelect = vi.fn();
    const entities1 = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
      ["n2", makeStructural("n2", "DB")],
    ]);

    const { rerender, getByTestId } = render(
      <GraphView entities={entities1} onSelect={onSelect} />,
    );

    // Remove one entity
    const entities2 = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
    ]);

    rerender(<GraphView entities={entities2} onSelect={onSelect} />);

    const svg = getByTestId("graph-view");
    expect(svg.querySelectorAll("g").length).toBeGreaterThan(0);
  });

  it("handles empty entities", () => {
    const { getByTestId } = render(
      <GraphView entities={new Map()} onSelect={vi.fn()} />,
    );
    expect(getByTestId("graph-view")).toBeTruthy();
  });
});
