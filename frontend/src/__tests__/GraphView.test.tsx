import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GraphView } from "../components/GraphView.js";
import type { Entity } from "../lib/store.js";

function makeEntities(): Map<string, Entity> {
  const map = new Map<string, Entity>();
  map.set("app-1", {
    id: "app-1",
    label: "App",
    name: "MyApp",
    status: "active",
    parent: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  });
  map.set("feat-1", {
    id: "feat-1",
    label: "Feature",
    name: "Auth",
    status: "active",
    parent: "app-1",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  });
  map.set("dec-1", {
    id: "dec-1",
    label: "Decision",
    title: "Use JWT",
    status: "accepted",
    date: "2026-01-01",
    affects: ["feat-1"],
    tags: [],
    context: "",
    decision: "",
    tradeoffs: "",
    alternatives: "",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  });
  return map;
}

describe("GraphView", () => {
  it("renders an SVG element", () => {
    const { container } = render(
      <GraphView entities={new Map()} onSelect={() => {}} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("renders nodes from entity data", () => {
    const entities = makeEntities();
    render(<GraphView entities={entities} onSelect={() => {}} />);
    expect(screen.getByText("MyApp")).toBeDefined();
    expect(screen.getByText("Auth")).toBeDefined();
    expect(screen.getByText("Use JWT")).toBeDefined();
  });

  it("calls onSelect when a node is clicked", () => {
    const entities = makeEntities();
    const onSelect = vi.fn();
    render(<GraphView entities={entities} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("MyApp"));
    expect(onSelect).toHaveBeenCalledWith("app-1");
  });
});
