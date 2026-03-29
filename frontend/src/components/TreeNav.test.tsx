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

  it("toggle button collapses the navigator (open=false branches)", () => {
    const { container } = render(
      <TreeNav entities={baseEntities} selectedEntityId={null} onNodeClick={vi.fn()} />,
    );

    const toggle = container.querySelector(".tree-nav__toggle")!;
    fireEvent.click(toggle);

    // After collapse, heading and body are gone
    expect(container.querySelector(".tree-nav__body")).toBeNull();
    // Toggle shows the expand icon
    expect(toggle.textContent).toBe("›");
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

  it("feature with no children has arrow with visibility hidden", () => {
    // hasChildren = false when feature has no components and no decisions
    const entities = new Map<string, Entity>([
      ["app", makeStructural("app", "App", "MyApp")],
      ["f1", makeStructural("f1", "Feature", "Lonely")],
    ]);

    const { container } = render(
      <TreeNav entities={entities} selectedEntityId={null} onNodeClick={vi.fn()} />,
    );

    const arrow = container.querySelector(".tree-accordion__arrow") as HTMLButtonElement;
    expect(arrow.style.visibility).toBe("hidden");
  });

  it("feature with decision (no components) has visible arrow and hasChildren true", () => {
    // Covers: decisionsByNode.get(feature.id)?.length (defined) and ?? 0 left branch
    const entities = new Map<string, Entity>([
      ["f1", makeStructural("f1", "Feature", "Auth")],
      ["d1", makeDecision("d1", "Architecture", ["f1"])],
    ]);

    const { container } = render(
      <TreeNav entities={entities} selectedEntityId={null} onNodeClick={vi.fn()} />,
    );

    const arrow = container.querySelector(".tree-accordion__arrow") as HTMLButtonElement;
    expect(arrow.style.visibility).toBe("visible");
  });

  it("app node gets selected class when it is the selectedEntityId", () => {
    const { container } = render(
      <TreeNav entities={baseEntities} selectedEntityId="app" onNodeClick={vi.fn()} />,
    );

    const appNode = container.querySelector(".tree-node--app");
    expect(appNode?.classList.contains("tree-node--selected")).toBe(true);
  });

  it("feature node gets selected class when it is the selectedEntityId", () => {
    const { container } = render(
      <TreeNav entities={baseEntities} selectedEntityId="f1" onNodeClick={vi.fn()} />,
    );

    const featureNode = container.querySelector(".tree-node--feature");
    expect(featureNode?.classList.contains("tree-node--selected")).toBe(true);
  });

  it("orphaned decision gets selected class when it is the selectedEntityId", () => {
    const entities = new Map<string, Entity>([
      ...baseEntities,
      ["d1", makeDecision("d1", "Choose DB", ["nonexistent"])],
    ]);

    const { container } = render(
      <TreeNav entities={entities} selectedEntityId="d1" onNodeClick={vi.fn()} />,
    );

    const orphanNode = container.querySelector(".tree-section--orphans .tree-node--decision");
    expect(orphanNode?.classList.contains("tree-node--selected")).toBe(true);
  });

  it("component node gets selected class when it is the selectedEntityId", () => {
    const { container } = render(
      <TreeNav
        entities={baseEntities}
        selectedEntityId="c1"
        onNodeClick={vi.fn()}
      />,
    );

    // Expand the feature to reveal the component
    const arrow = container.querySelector(".tree-accordion__arrow")!;
    fireEvent.click(arrow);

    const componentNode = container.querySelector(".tree-node--component");
    expect(componentNode?.classList.contains("tree-node--selected")).toBe(true);
  });

  it("orphaned decision shows error badge when its id is in errorIds", () => {
    const entities = new Map<string, Entity>([
      ...baseEntities,
      ["d1", makeDecision("d1", "Choose DB", ["nonexistent"])],
    ]);

    const { container } = render(
      <TreeNav
        entities={entities}
        selectedEntityId={null}
        onNodeClick={vi.fn()}
        errorIds={new Set(["d1"])}
      />,
    );

    // The orphaned decision section renders a badge for d1
    const badge = container.querySelector(".tree-node__badge--error");
    expect(badge).toBeTruthy();
  });

  it("decision under feature gets selected class when it is the selectedEntityId", () => {
    const entities = new Map<string, Entity>([
      ...baseEntities,
      ["d1", makeDecision("d1", "Use JWT", ["f1"])],
    ]);

    const { container, getByTitle } = render(
      <TreeNav entities={entities} selectedEntityId="d1" onNodeClick={vi.fn()} />,
    );

    // Expand the feature to reveal the decision
    const arrow = container.querySelector(".tree-accordion__arrow")!;
    fireEvent.click(arrow);

    const decisionBtn = getByTitle("Use JWT");
    expect(decisionBtn.classList.contains("tree-node--selected")).toBe(true);
  });

  it("decision in renderDecisions gets error badge when errorIds contains its id", () => {
    const entities = new Map<string, Entity>([
      ...baseEntities,
      ["d1", makeDecision("d1", "Use JWT", ["app"])],
    ]);

    const { container } = render(
      <TreeNav
        entities={entities}
        selectedEntityId={null}
        onNodeClick={vi.fn()}
        errorIds={new Set(["d1"])}
      />,
    );

    // d1 is attached to app node — its badge should appear in renderDecisions output
    const badges = container.querySelectorAll(".tree-node__badge--error");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("component with null parent uses empty string as feature key (pid ?? '')", () => {
    // Covers: const pid = c.parent ?? "" in buildTreeData
    const entities = new Map<string, Entity>([
      ["c1", makeStructural("c1", "Component", "Orphan", null)],
    ]);
    const tree = buildTreeData(entities);
    // Component with null parent maps to "" key in componentsByFeature
    expect(tree.componentsByFeature.get("")).toBeDefined();
    expect(tree.componentsByFeature.get("")![0].id).toBe("c1");
  });

  it("collapsing an already-expanded feature removes it from expanded set", () => {
    const { container } = render(
      <TreeNav entities={baseEntities} selectedEntityId={null} onNodeClick={vi.fn()} />,
    );

    const arrow = container.querySelector(".tree-accordion__arrow")!;
    // Expand
    fireEvent.click(arrow);
    expect(arrow.getAttribute("aria-expanded")).toBe("true");
    // Collapse — covers the `next.has(id)` true branch
    fireEvent.click(arrow);
    expect(arrow.getAttribute("aria-expanded")).toBe("false");
  });

  it("calls onNodeClick when a feature node is clicked", () => {
    const onNodeClick = vi.fn();
    const { getByTitle } = render(
      <TreeNav entities={baseEntities} selectedEntityId={null} onNodeClick={onNodeClick} />,
    );

    fireEvent.click(getByTitle("Auth"));
    expect(onNodeClick).toHaveBeenCalledWith("f1");
  });

  it("calls onNodeClick when an orphaned decision is clicked", () => {
    const onNodeClick = vi.fn();
    const entities = new Map<string, Entity>([
      ...baseEntities,
      ["d1", makeDecision("d1", "Choose DB", ["nonexistent"])],
    ]);

    const { getByTitle } = render(
      <TreeNav entities={entities} selectedEntityId={null} onNodeClick={onNodeClick} />,
    );

    fireEvent.click(getByTitle("Choose DB"));
    expect(onNodeClick).toHaveBeenCalledWith("d1");
  });

  it("calls onNodeClick when a component node is clicked", () => {
    const onNodeClick = vi.fn();
    const { container } = render(
      <TreeNav entities={baseEntities} selectedEntityId={null} onNodeClick={onNodeClick} />,
    );

    // Expand the feature to reveal the component
    const arrow = container.querySelector(".tree-accordion__arrow")!;
    fireEvent.click(arrow);

    fireEvent.click(container.querySelector(".tree-node--component")!);
    expect(onNodeClick).toHaveBeenCalledWith("c1");
  });

  it("calls onNodeClick when a decision inside renderDecisions is clicked", () => {
    const onNodeClick = vi.fn();
    const entities = new Map<string, Entity>([
      ...baseEntities,
      ["d1", makeDecision("d1", "Use JWT", ["c1"])],
    ]);

    const { container, getByTitle } = render(
      <TreeNav entities={entities} selectedEntityId={null} onNodeClick={onNodeClick} />,
    );

    // Expand feature to reveal component + decision
    const arrow = container.querySelector(".tree-accordion__arrow")!;
    fireEvent.click(arrow);

    fireEvent.click(getByTitle("Use JWT"));
    expect(onNodeClick).toHaveBeenCalledWith("d1");
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
