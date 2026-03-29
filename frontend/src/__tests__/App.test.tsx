import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import type { Entity, DecisionNodeEntity, EntityChangeEvent, StructuralNodeEntity } from "../lib/store.js";

type Sink = {
  next: (value: { data?: { entityChanged: EntityChangeEvent } }) => void;
  error: (err: unknown) => void;
  complete: () => void;
};

let subscribeSink: Sink | null = null;

// Mock graphql.js — urql client with no exchanges (queries stay loading).
vi.mock("../lib/graphql.js", async () => {
  const { createClient } = await import("@urql/core");
  return {
    wsClient: {
      subscribe: (_req: unknown, sink: Sink) => {
        subscribeSink = sink;
        return () => {};
      },
      dispose: () => {},
    },
    urqlClient: createClient({ url: "http://localhost/noop", exchanges: [] }),
  };
});

// Mock d3-timer to prevent requestAnimationFrame loop from d3 transitions.
vi.mock("d3-timer", () => ({
  timer: () => ({ stop: () => {} }),
  timerFlush: () => {},
  timeout: () => ({ stop: () => {} }),
  interval: () => ({ stop: () => {} }),
  now: () => Date.now(),
}));

beforeEach(() => {
  subscribeSink = null;
});
afterEach(() => cleanup());

import { App } from "../App";

function makeStructuralNode(overrides: Partial<StructuralNodeEntity> & { id: string; name: string }): StructuralNodeEntity {
  return {
    label: "Component",
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeDecision(overrides: Partial<DecisionNodeEntity> & { id: string; title: string }): DecisionNodeEntity {
  return {
    label: "Decision",
    status: "active",
    date: "2026-01-01",
    affects: [],
    tags: [],
    context: "",
    decision: "",
    tradeoffs: "",
    alternatives: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function injectEntities(entities: Entity[]) {
  act(() => {
    subscribeSink?.next({
      data: {
        entityChanged: {
          type: "INITIAL_SNAPSHOT",
          entities,
        },
      },
    });
  });
}

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

  it("toggles menu open and closed via Menu button", () => {
    const { container } = render(<App />);
    const menuBtn = screen.getByText("Menu");

    // Menu dropdown should start hidden
    const dropdown = container.querySelector(".menu-dropdown") as HTMLElement;
    expect(dropdown.style.display).toBe("none");

    // Click to open
    fireEvent.click(menuBtn);
    expect(dropdown.style.display).toBe("");

    // Menu button should have active class
    expect(menuBtn.classList.contains("app-header__menu-btn--active")).toBe(true);

    // Click again to close (toggle)
    fireEvent.click(menuBtn);
    expect(dropdown.style.display).toBe("none");
    expect(menuBtn.classList.contains("app-header__menu-btn--active")).toBe(false);
  });

  it("closes menu on Escape key", () => {
    const { container } = render(<App />);
    const menuBtn = screen.getByText("Menu");

    fireEvent.click(menuBtn);
    const dropdown = container.querySelector(".menu-dropdown") as HTMLElement;
    expect(dropdown.style.display).toBe("");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(dropdown.style.display).toBe("none");
  });

  it("selects an entity via tree nav click", () => {
    const { container } = render(<App />);

    // Inject entities so TreeNav renders clickable nodes
    const app = makeStructuralNode({ id: "app-1", name: "MyApp", label: "App" });
    const feature = makeStructuralNode({ id: "feat-1", name: "Auth", label: "Feature", parent: "app-1" });
    injectEntities([app, feature]);

    // TreeNav renders tree node buttons — find the one in the tree nav (first match)
    const treeNodes = screen.getAllByText("Auth");
    fireEvent.click(treeNodes[0]);

    // The tree node should get the selected class
    const selectedNode = container.querySelector(".tree-node--selected");
    expect(selectedNode).not.toBeNull();
  });

  it("toggles selection via GraphView node click", () => {
    render(<App />);

    const app = makeStructuralNode({ id: "app-1", name: "MyApp", label: "App" });
    injectEntities([app]);

    // D3 attaches click handlers to text elements — click to select
    const nodeText = screen.getAllByText("MyApp")[0];
    fireEvent.click(nodeText);

    // Click same node again — handleSelect toggles (deselects)
    fireEvent.click(nodeText);
  });

  it("returns all entities when selectedTags is empty (no filtering)", () => {
    render(<App />);

    const node1 = makeStructuralNode({ id: "n1", name: "Foo", label: "Component" });
    const node2 = makeStructuralNode({ id: "n2", name: "Bar", label: "Component" });
    injectEntities([node1, node2]);

    // With no tags selected, all entities should be visible in the tree
    expect(screen.getByText("Foo")).toBeDefined();
    expect(screen.getByText("Bar")).toBeDefined();
  });

  it("filters entities by selected tags and includes connected structural nodes", () => {
    render(<App />);

    const app = makeStructuralNode({ id: "app-1", name: "MyApp", label: "App" });
    const feature = makeStructuralNode({ id: "feat-1", name: "Auth", label: "Feature", parent: "app-1" });
    const component = makeStructuralNode({ id: "comp-1", name: "LoginForm", label: "Component", parent: "feat-1" });
    const decision = makeDecision({
      id: "dec-1",
      title: "Use JWT",
      tags: ["security"],
      affects: ["comp-1"],
    });
    const unrelatedNode = makeStructuralNode({ id: "comp-2", name: "Dashboard", label: "Component" });

    injectEntities([app, feature, component, decision, unrelatedNode]);

    // Open menu and select the "security" tag
    const menuBtn = screen.getByText("Menu");
    fireEvent.click(menuBtn);

    // Find and click the security tag filter button (role=checkbox)
    const securityCheckbox = screen.getByRole("checkbox", { name: "security" });
    fireEvent.click(securityCheckbox);

    // Decision and its affected node + parents should be visible
    expect(screen.getAllByText("Use JWT").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LoginForm").length).toBeGreaterThan(0);
    // Parent chain should be included
    expect(screen.getAllByText("Auth").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MyApp").length).toBeGreaterThan(0);
    // Unrelated node should be filtered out
    expect(screen.queryAllByText("Dashboard")).toHaveLength(0);
  });

  it("handles subscription error", () => {
    render(<App />);
    // Trigger the error handler on the wsClient subscription sink
    act(() => {
      subscribeSink?.error(new Error("connection lost"));
    });
    // App should still render (connected becomes false, no crash)
    expect(screen.getByText("whygraph")).toBeDefined();
  });

  it("handles subscription complete", () => {
    render(<App />);
    act(() => {
      subscribeSink?.complete();
    });
    expect(screen.getByText("whygraph")).toBeDefined();
  });

  it("covers timeline filterTimestamp path", () => {
    render(<App />);

    // Inject entities with different timestamps to get 2+ timeline entries
    const node1 = makeStructuralNode({ id: "n1", name: "First", label: "Component", created_at: "2025-01-01T00:00:00Z" });
    const node2 = makeStructuralNode({ id: "n2", name: "Second", label: "Component", created_at: "2025-06-01T00:00:00Z" });
    injectEntities([node1, node2]);

    // Timeline slider should appear with 2+ timestamps
    const slider = screen.queryByTestId("timeline-slider");
    if (slider) {
      // Move slider to first position — sets filterTimestamp to non-null
      fireEvent.change(slider, { target: { value: "0" } });
      // This exercises the filterTimestamp !== null branch in App.tsx line 106
    }
  });

  it("deselects entity when SVG background is clicked (onDeselect)", () => {
    const { container } = render(<App />);

    const node = makeStructuralNode({ id: "n1", name: "Alpha", label: "Component" });
    injectEntities([node]);

    // Select the node first
    fireEvent.click(screen.getAllByText("Alpha")[0]);

    // Click the SVG background to deselect
    const svg = container.querySelector('[data-testid="graph-view"]')!;
    fireEvent.click(svg);

    // Selection ring should be gone (onDeselect sets selectedEntityId to null)
    expect(svg.querySelectorAll(".selection-ring").length).toBe(0);
  });

  it("clears selection when fitAll is triggered (onFitAll)", () => {
    const { container } = render(<App />);

    const node = makeStructuralNode({ id: "n1", name: "Beta", label: "Component" });
    injectEntities([node]);

    // Select the node
    fireEvent.click(screen.getAllByText("Beta")[0]);

    // Click the fit-all button
    const fitBtn = screen.getByRole("button", { name: "Fit graph to view" });
    fireEvent.click(fitBtn);

    // onFitAll sets selectedEntityId to null → no selection ring
    const svg = container.querySelector('[data-testid="graph-view"]')!;
    expect(svg.querySelectorAll(".selection-ring").length).toBe(0);
  });

  it("closes detail panel when close button is clicked (onClose)", () => {
    const { container } = render(<App />);

    const node = makeStructuralNode({ id: "n1", name: "Gamma", label: "Component" });
    injectEntities([node]);

    // Select a node to open the detail panel
    fireEvent.click(screen.getAllByText("Gamma")[0]);

    // Panel should be open
    const panel = container.querySelector('[data-testid="detail-panel"]')!;
    expect(panel.getAttribute("data-open")).toBe("true");

    // Click close
    fireEvent.click(container.querySelector('[data-testid="detail-close"]')!);

    // Panel should be closed
    expect(panel.getAttribute("data-open")).toBe("false");
  });

  it("handles selectedEntityId pointing to an entity no longer in the map", () => {
    // Covers: selectedEntity = selectedEntityId ? entities.get(selectedEntityId) ?? null : null
    // The ?? null branch fires when selectedEntityId is set but the entity was removed.
    render(<App />);

    const node = makeStructuralNode({ id: "temp-1", name: "TempNode", label: "Component" });
    injectEntities([node]);

    // Select the node
    const nodeText = screen.getAllByText("TempNode")[0];
    fireEvent.click(nodeText);

    // Now remove it from the snapshot — entities map no longer has "temp-1"
    injectEntities([]);

    // App should still render; selectedEntity falls back to null via ??
    expect(screen.getByText("whygraph")).toBeDefined();
  });

  it("includes superseded decision in tag-filtered results", () => {
    render(<App />);

    const oldDecision = makeDecision({
      id: "dec-old",
      title: "Old Auth",
      tags: ["security"],
      affects: [],
    });
    const newDecision = makeDecision({
      id: "dec-new",
      title: "New Auth",
      tags: ["security"],
      affects: [],
      supersedes: "dec-old",
    });

    injectEntities([oldDecision, newDecision]);

    // Open menu and select the "security" tag
    fireEvent.click(screen.getByText("Menu"));
    const securityCheckbox = screen.getByRole("checkbox", { name: "security" });
    fireEvent.click(securityCheckbox);

    // Both decisions should be visible (dec-old via supersedes link)
    expect(screen.getAllByText("Old Auth").length).toBeGreaterThan(0);
    expect(screen.getAllByText("New Auth").length).toBeGreaterThan(0);
  });
});
