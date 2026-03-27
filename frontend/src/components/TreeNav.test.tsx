import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TreeNav, buildTreeData } from "./TreeNav.js";
import type { Entity, StructuralNodeEntity, DecisionNodeEntity } from "../lib/store.js";

function makeStructural(
  id: string,
  label: "App" | "Feature" | "Component",
  name: string,
  parent: string | null = null,
): StructuralNodeEntity {
  return {
    id,
    label,
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    removed_at: null,
    name,
    parent,
    description: null,
    refs: null,
  };
}

function makeDecision(
  id: string,
  title: string,
  affects: string[],
): DecisionNodeEntity {
  return {
    id,
    label: "Decision",
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    removed_at: null,
    title,
    date: "2025-01-01",
    context: "",
    decision: "",
    tradeoffs: "",
    alternatives: "",
    tags: [],
    affects,
    supersedes: null,
  };
}

describe("buildTreeData", () => {
  it("categorizes app, features, and components", () => {
    const entities = new Map<string, Entity>([
      ["app", makeStructural("app", "App", "MyApp")],
      ["f1", makeStructural("f1", "Feature", "Auth")],
      ["c1", makeStructural("c1", "Component", "LoginForm", "f1")],
    ]);

    const tree = buildTreeData(entities);

    expect(tree.app?.id).toBe("app");
    expect(tree.features).toHaveLength(1);
    expect(tree.features[0].id).toBe("f1");
    expect(tree.componentsByFeature.get("f1")).toHaveLength(1);
    expect(tree.componentsByFeature.get("f1")![0].id).toBe("c1");
  });

  it("attaches decisions to first matching affects entry", () => {
    const entities = new Map<string, Entity>([
      ["c1", makeStructural("c1", "Component", "LoginForm", "f1")],
      ["d1", makeDecision("d1", "Use JWT", ["c1"])],
    ]);

    const tree = buildTreeData(entities);

    expect(tree.decisionsByNode.get("c1")).toHaveLength(1);
    expect(tree.decisionsByNode.get("c1")![0].id).toBe("d1");
    expect(tree.orphanedDecisions).toHaveLength(0);
  });

  it("puts decisions with no visible affected nodes in orphanedDecisions", () => {
    const entities = new Map<string, Entity>([
      ["d1", makeDecision("d1", "Choose DB", ["nonexistent-node"])],
    ]);

    const tree = buildTreeData(entities);

    expect(tree.orphanedDecisions).toHaveLength(1);
    expect(tree.orphanedDecisions[0].id).toBe("d1");
    expect(tree.decisionsByNode.size).toBe(0);
  });

  it("skips affects entries not in entity set, falls through to next", () => {
    const entities = new Map<string, Entity>([
      ["c1", makeStructural("c1", "Component", "Widget", "f1")],
      ["d1", makeDecision("d1", "Use Hooks", ["missing", "c1"])],
    ]);

    const tree = buildTreeData(entities);

    // "missing" not in entities, so attaches to "c1"
    expect(tree.decisionsByNode.get("c1")).toHaveLength(1);
    expect(tree.orphanedDecisions).toHaveLength(0);
  });

  it("returns null app when no App entity exists", () => {
    const entities = new Map<string, Entity>([
      ["f1", makeStructural("f1", "Feature", "Auth")],
    ]);

    const tree = buildTreeData(entities);
    expect(tree.app).toBeNull();
  });
});

describe("TreeNav component", () => {
  const baseEntities = new Map<string, Entity>([
    ["app", makeStructural("app", "App", "MyApp")],
    ["f1", makeStructural("f1", "Feature", "Auth")],
    ["c1", makeStructural("c1", "Component", "LoginForm", "f1")],
  ]);

  it("renders app node", () => {
    const { getByTitle } = render(
      <TreeNav
        entities={baseEntities}
        selectedEntityId={null}
        onNodeClick={vi.fn()}
      />,
    );
    expect(getByTitle("MyApp")).toBeTruthy();
  });

  it("starts with features collapsed", () => {
    const { queryByTitle } = render(
      <TreeNav
        entities={baseEntities}
        selectedEntityId={null}
        onNodeClick={vi.fn()}
      />,
    );
    // Component is inside the feature accordion — should not be visible initially
    expect(queryByTitle("LoginForm")).toBeNull();
  });

  it("expands feature on arrow click", () => {
    const { getByTitle, container } = render(
      <TreeNav
        entities={baseEntities}
        selectedEntityId={null}
        onNodeClick={vi.fn()}
      />,
    );

    const arrow = container.querySelector(".tree-accordion__arrow")!;
    expect(arrow).toBeTruthy();
    fireEvent.click(arrow);

    expect(getByTitle("LoginForm")).toBeTruthy();
  });

  it("calls onNodeClick when a node is clicked", () => {
    const onNodeClick = vi.fn();
    const { getByTitle } = render(
      <TreeNav
        entities={baseEntities}
        selectedEntityId={null}
        onNodeClick={onNodeClick}
      />,
    );

    fireEvent.click(getByTitle("MyApp"));
    expect(onNodeClick).toHaveBeenCalledWith("app");
  });

  it("shows error badge for nodes with errors", () => {
    const { container } = render(
      <TreeNav
        entities={baseEntities}
        selectedEntityId={null}
        onNodeClick={vi.fn()}
        errorIds={new Set(["app"])}
      />,
    );

    const badge = container.querySelector(".tree-node__badge--error");
    expect(badge).toBeTruthy();
  });

  it("shows orphaned decisions section when decisions have no visible affected nodes", () => {
    const entities = new Map<string, Entity>([
      ...baseEntities,
      ["d1", makeDecision("d1", "Choose DB", ["nonexistent"])],
    ]);

    const { getByText } = render(
      <TreeNav
        entities={entities}
        selectedEntityId={null}
        onNodeClick={vi.fn()}
      />,
    );

    expect(getByText("Decisions")).toBeTruthy();
    expect(getByText("Choose DB")).toBeTruthy();
  });

  it("shows stale ref badge for nodes with stale refs", () => {
    const { container } = render(
      <TreeNav
        entities={baseEntities}
        selectedEntityId={null}
        onNodeClick={vi.fn()}
        staleRefIds={new Set(["app"])}
      />,
    );

    const badge = container.querySelector(".tree-node__badge--stale");
    expect(badge).toBeTruthy();
  });

  it("renders decision buttons under expanded component", () => {
    const entities = new Map<string, Entity>([
      ...baseEntities,
      ["d1", makeDecision("d1", "Use JWT", ["c1"])],
    ]);

    const { container, getByTitle } = render(
      <TreeNav
        entities={entities}
        selectedEntityId={null}
        onNodeClick={vi.fn()}
      />,
    );

    // Expand the feature to reveal components and decisions
    const arrow = container.querySelector(".tree-accordion__arrow")!;
    fireEvent.click(arrow);

    expect(getByTitle("Use JWT")).toBeTruthy();
  });
});
