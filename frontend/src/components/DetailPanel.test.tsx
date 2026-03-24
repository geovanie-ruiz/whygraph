import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { DetailPanel } from "./DetailPanel.js";
import type {
  Entity,
  StructuralNodeEntity,
  DecisionNodeEntity,
} from "../lib/store.js";

function makeDecision(overrides: Partial<DecisionNodeEntity> = {}): DecisionNodeEntity {
  return {
    id: "d1",
    label: "Decision",
    status: "accepted",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    title: "Use GraphQL",
    date: "2025-01-01",
    affects: [],
    tags: ["architecture"],
    supersedes: null,
    context: "We need an API layer",
    decision: "Use GraphQL for all queries",
    tradeoffs: "More complex than REST",
    alternatives: "REST, gRPC",
    ...overrides,
  };
}

function makeStructural(overrides: Partial<StructuralNodeEntity> = {}): StructuralNodeEntity {
  return {
    id: "s1",
    label: "Component",
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    name: "AuthService",
    parent: "feat-1",
    description: "Handles authentication",
    refs: [{ file: "src/auth.ts", symbol: "AuthService" }],
    ...overrides,
  };
}

describe("DetailPanel", () => {
  it("renders decision fields when decision is selected", () => {
    const decision = makeDecision();
    const entities = new Map<string, Entity>([["d1", decision]]);

    const { getByTestId, getByText } = render(
      <DetailPanel entity={decision} entities={entities} onClose={vi.fn()} />,
    );

    expect(getByTestId("decision-detail")).toBeTruthy();
    expect(getByText("Use GraphQL")).toBeTruthy();
    expect(getByText("accepted")).toBeTruthy();
    expect(getByText("2025-01-01")).toBeTruthy();
    expect(getByText("architecture")).toBeTruthy();
    expect(getByText("We need an API layer")).toBeTruthy();
    expect(getByText("Use GraphQL for all queries")).toBeTruthy();
    expect(getByText("More complex than REST")).toBeTruthy();
    expect(getByText("REST, gRPC")).toBeTruthy();
  });

  it("renders structural node fields", () => {
    const structural = makeStructural();
    const entities = new Map<string, Entity>([["s1", structural]]);

    const { getByTestId, getByText } = render(
      <DetailPanel entity={structural} entities={entities} onClose={vi.fn()} />,
    );

    expect(getByTestId("structural-detail")).toBeTruthy();
    expect(getByText("AuthService")).toBeTruthy();
    expect(getByText("Component")).toBeTruthy();
    expect(getByText("active")).toBeTruthy();
    expect(getByText("feat-1")).toBeTruthy();
    expect(getByText("Handles authentication")).toBeTruthy();
  });

  it("renders nothing visible when entity is null", () => {
    const { getByTestId, queryByTestId } = render(
      <DetailPanel entity={null} entities={new Map()} onClose={vi.fn()} />,
    );

    // Panel container exists but is closed (data-open="false")
    const panel = getByTestId("detail-panel");
    expect(panel.dataset.open).toBe("false");
    expect(queryByTestId("decision-detail")).toBeNull();
    expect(queryByTestId("structural-detail")).toBeNull();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    const decision = makeDecision();

    const { getByTestId } = render(
      <DetailPanel
        entity={decision}
        entities={new Map([["d1", decision]])}
        onClose={onClose}
      />,
    );

    fireEvent.click(getByTestId("detail-close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows affected node names resolved from entities map", () => {
    const structural = makeStructural({ id: "s1", name: "AuthService" });
    const decision = makeDecision({ affects: ["s1"] });
    const entities = new Map<string, Entity>([
      ["d1", decision],
      ["s1", structural],
    ]);

    const { getByText } = render(
      <DetailPanel entity={decision} entities={entities} onClose={vi.fn()} />,
    );

    expect(getByText("AuthService")).toBeTruthy();
  });
});
