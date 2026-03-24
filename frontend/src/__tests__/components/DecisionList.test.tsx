import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "urql";
import { fromValue, never } from "wonka";
import { DecisionList } from "../../components/DecisionList";

function makeClient(executeResult: unknown) {
  return {
    executeQuery: () => fromValue(executeResult),
    executeMutation: () => never,
    executeSubscription: () => never,
  } as never;
}

const sampleDecisions = [
  {
    id: "wg-d1",
    title: "Use GraphQL",
    status: "active",
    date: "2026-03-01",
    tags: ["arch"],
    affects: ["api-module"],
  },
  {
    id: "wg-d2",
    title: "Switch to REST",
    status: "superseded",
    date: "2026-02-15",
    tags: ["arch", "integration"],
    affects: ["api-module", "client"],
  },
];

describe("DecisionList", () => {
  it("renders decision rows", () => {
    const client = makeClient({ data: { decisions: sampleDecisions } });

    render(
      <Provider value={client}>
        <DecisionList />
      </Provider>,
    );

    expect(screen.getByText("Use GraphQL")).toBeDefined();
    expect(screen.getByText("Switch to REST")).toBeDefined();
  });

  it("renders empty state when no decisions", () => {
    const client = makeClient({ data: { decisions: [] } });

    render(
      <Provider value={client}>
        <DecisionList />
      </Provider>,
    );

    expect(screen.getByTestId("empty-state")).toBeDefined();
    expect(screen.getByText("No decisions found")).toBeDefined();
  });

  it("calls onSelect when a row is clicked", async () => {
    const client = makeClient({ data: { decisions: sampleDecisions } });
    const onSelect = vi.fn();

    render(
      <Provider value={client}>
        <DecisionList onSelect={onSelect} />
      </Provider>,
    );

    const row = screen.getByTestId("decision-row-wg-d1");
    row.click();

    expect(onSelect).toHaveBeenCalledWith(sampleDecisions[0]);
  });

  it("renders search input", () => {
    const client = makeClient({ data: { decisions: [] } });

    render(
      <Provider value={client}>
        <DecisionList />
      </Provider>,
    );

    expect(screen.getByPlaceholderText("Search decisions...")).toBeDefined();
  });

  it("renders tag filter buttons", () => {
    const client = makeClient({ data: { decisions: [] } });

    render(
      <Provider value={client}>
        <DecisionList />
      </Provider>,
    );

    expect(screen.getByText("arch")).toBeDefined();
    expect(screen.getByText("security")).toBeDefined();
    expect(screen.getByText("ux")).toBeDefined();
  });

  it("renders status filter dropdown", () => {
    const client = makeClient({ data: { decisions: [] } });

    render(
      <Provider value={client}>
        <DecisionList />
      </Provider>,
    );

    expect(screen.getByLabelText("Filter by status")).toBeDefined();
  });
});
