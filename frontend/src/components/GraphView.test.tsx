import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { createRef } from "react";
import { GraphView } from "./GraphView.js";
import type { GraphViewHandle } from "./GraphView.js";
import type { Entity } from "../lib/store.js";

// d3-timer drives the force simulation; mock it so tests don't hang.
vi.mock("d3-timer", () => ({
  timer: (_cb: unknown) => ({ stop: () => {} }),
  timerFlush: () => {},
  timeout: (_cb: unknown) => ({ stop: () => {} }),
  interval: (_cb: unknown) => ({ stop: () => {} }),
  now: () => Date.now(),
}));

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

  it("renders node text labels in the SVG", () => {
    const entities = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
      ["n2", makeStructural("n2", "Database", "Feature")],
    ]);
    render(<GraphView entities={entities} onSelect={vi.fn()} />);
    expect(screen.getByText("Auth")).toBeDefined();
    expect(screen.getByText("Database")).toBeDefined();
  });

  it("calls onSelect when a node is clicked", () => {
    const onSelect = vi.fn();
    const entities = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
    ]);
    render(<GraphView entities={entities} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Auth"));
    expect(onSelect).toHaveBeenCalledWith("n1");
  });

  it("renders selection ring when selectedEntityId is set", () => {
    const entities = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
      ["n2", makeStructural("n2", "DB")],
    ]);
    const { getByTestId } = render(
      <GraphView entities={entities} onSelect={vi.fn()} selectedEntityId="n1" />,
    );
    const svg = getByTestId("graph-view");
    const rings = svg.querySelectorAll(".selection-ring");
    // Three rings: separation gap, outer glow, crisp accent
    expect(rings.length).toBe(3);
  });

  it("removes selection ring when selectedEntityId is cleared", () => {
    const entities = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
    ]);
    const { rerender, getByTestId } = render(
      <GraphView entities={entities} onSelect={vi.fn()} selectedEntityId="n1" />,
    );
    const svg = getByTestId("graph-view");
    expect(svg.querySelectorAll(".selection-ring").length).toBe(3);

    rerender(<GraphView entities={entities} onSelect={vi.fn()} selectedEntityId={null} />);
    expect(svg.querySelectorAll(".selection-ring").length).toBe(0);
  });

  it("renders gap highlights when highlightedIds is provided", () => {
    const entities = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
      ["n2", makeStructural("n2", "DB")],
    ]);
    const { getByTestId } = render(
      <GraphView
        entities={entities}
        onSelect={vi.fn()}
        highlightedIds={new Set(["n1"])}
      />,
    );
    const svg = getByTestId("graph-view");
    const highlights = svg.querySelectorAll(".gap-highlight");
    expect(highlights.length).toBe(1);
  });

  it("renders error rings when errorIds is provided", () => {
    const entities = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
      ["n2", makeStructural("n2", "DB")],
    ]);
    const { getByTestId } = render(
      <GraphView
        entities={entities}
        onSelect={vi.fn()}
        errorIds={new Set(["n1", "n2"])}
      />,
    );
    const svg = getByTestId("graph-view");
    const errorRings = svg.querySelectorAll(".error-ring");
    expect(errorRings.length).toBe(2);
  });

  it("renders stale ref badges when staleRefIds is provided", () => {
    const entities = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
    ]);
    const { getByTestId } = render(
      <GraphView
        entities={entities}
        onSelect={vi.fn()}
        staleRefIds={new Set(["n1"])}
      />,
    );
    const svg = getByTestId("graph-view");
    expect(svg.querySelectorAll(".stale-ref-badge").length).toBe(1);
    expect(svg.querySelectorAll(".stale-ref-badge-text").length).toBe(1);
    // The badge text is "!"
    expect(svg.querySelector(".stale-ref-badge-text")?.textContent).toBe("!");
  });

  it("exposes zoomToNode via ref", () => {
    const entities = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
    ]);
    const ref = createRef<GraphViewHandle>();
    render(
      <GraphView ref={ref} entities={entities} onSelect={vi.fn()} />,
    );
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current!.zoomToNode).toBe("function");
    // Calling zoomToNode should not throw (node position may not exist yet,
    // which means the early-return fires, but it must not crash).
    expect(() => ref.current!.zoomToNode("n1")).not.toThrow();
  });

  it("exposes fitAll via ref and triggers onFitAll callback", () => {
    const onFitAll = vi.fn();
    const entities = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
    ]);
    const ref = createRef<GraphViewHandle>();
    render(
      <GraphView ref={ref} entities={entities} onSelect={vi.fn()} onFitAll={onFitAll} />,
    );
    expect(ref.current).not.toBeNull();
    // fitAll is exposed on the handle
    expect(typeof (ref.current as unknown as { fitAll: unknown }).fitAll).toBe("function");
    act(() => {
      (ref.current as unknown as { fitAll: () => void }).fitAll();
    });
    expect(onFitAll).toHaveBeenCalled();
  });

  it("renders decision node shapes as rotated rects", () => {
    const entities = new Map<string, Entity>([
      ["d1", makeDecision("d1", "Use JWT")],
    ]);
    const { getByTestId } = render(
      <GraphView entities={entities} onSelect={vi.fn()} />,
    );
    const svg = getByTestId("graph-view");
    // Decision nodes use a rect rotated 45 degrees instead of a circle
    const rects = svg.querySelectorAll("rect.node-shape");
    expect(rects.length).toBe(1);
    expect(rects[0].getAttribute("transform")).toBe("rotate(45)");
  });

  it("calls onDeselect when background SVG is clicked", () => {
    const onDeselect = vi.fn();
    const entities = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
    ]);
    const { getByTestId } = render(
      <GraphView entities={entities} onSelect={vi.fn()} onDeselect={onDeselect} />,
    );
    fireEvent.click(getByTestId("graph-view"));
    expect(onDeselect).toHaveBeenCalled();
  });

  it("fitAll button calls fitAll and onFitAll", () => {
    const onFitAll = vi.fn();
    const entities = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
    ]);
    render(
      <GraphView entities={entities} onSelect={vi.fn()} onFitAll={onFitAll} />,
    );
    const btn = screen.getByRole("button", { name: "Fit graph to view" });
    fireEvent.click(btn);
    expect(onFitAll).toHaveBeenCalled();
  });

  it("combines error rings, gap highlights, and stale refs simultaneously", () => {
    const entities = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
      ["n2", makeStructural("n2", "DB")],
      ["n3", makeStructural("n3", "API")],
    ]);
    const { getByTestId } = render(
      <GraphView
        entities={entities}
        onSelect={vi.fn()}
        errorIds={new Set(["n1"])}
        highlightedIds={new Set(["n2"])}
        staleRefIds={new Set(["n3"])}
      />,
    );
    const svg = getByTestId("graph-view");
    expect(svg.querySelectorAll(".error-ring").length).toBe(1);
    expect(svg.querySelectorAll(".gap-highlight").length).toBe(1);
    expect(svg.querySelectorAll(".stale-ref-badge").length).toBe(1);
  });

  it("splits long node names into multiple tspan lines", () => {
    const entities = new Map<string, Entity>([
      ["n1", makeStructural("n1", "AuthenticationService")],
      ["n2", makeStructural("n2", "very-long-component-name-here")],
    ]);
    const { getByTestId } = render(
      <GraphView entities={entities} onSelect={vi.fn()} />,
    );
    const svg = getByTestId("graph-view");
    // splitLabel breaks "AuthenticationService" at camelCase → "Authentication" + "Service"
    const tspans = svg.querySelectorAll("tspan");
    expect(tspans.length).toBeGreaterThan(2);
  });

  it("renders node with unknown label using default radius and color", () => {
    // An entity with a label not in the known set hits the default branches
    // in nodeRadius (returns 10) and nodeColor (returns "#999").
    const entities = new Map<string, Entity>([
      ["b1", makeStructural("b1", "BugReport", "Bug")],
    ]);
    const { getByTestId } = render(
      <GraphView entities={entities} onSelect={vi.fn()} />,
    );
    const svg = getByTestId("graph-view");
    // Node is rendered — confirms the default switch branches didn't throw
    expect(svg.querySelectorAll("g.node-group").length).toBe(1);
    expect(screen.getByText("BugReport")).toBeDefined();
  });

  it("does not crash when selectedEntityId has no matching node", () => {
    // When selectedEntityId points to an ID not in the rendered graph,
    // the selection effect hits `if (target.empty()) return` without throwing.
    const entities = new Map<string, Entity>([
      ["n1", makeStructural("n1", "Auth")],
    ]);
    expect(() =>
      render(
        <GraphView
          entities={entities}
          onSelect={vi.fn()}
          selectedEntityId="nonexistent-id"
        />,
      ),
    ).not.toThrow();
  });
});
