import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Provider } from "urql";
import { fromValue, never } from "wonka";
import { DecisionList } from "../../components/DecisionList.js";

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

  it("toggles tag filter on and off", () => {
    const client = makeClient({ data: { decisions: [] } });

    render(
      <Provider value={client}>
        <DecisionList />
      </Provider>,
    );

    const archButton = screen.getByText("arch");
    expect(archButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(archButton);
    expect(archButton.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(archButton);
    expect(archButton.getAttribute("aria-pressed")).toBe("false");
  });

  it("uses search results when search text is present", async () => {
    vi.useFakeTimers();

    const searchDecisions = [
      {
        id: "wg-s1",
        title: "Search Result Decision",
        status: "active",
        date: "2026-03-10",
        tags: ["data"],
        affects: ["search-module"],
      },
    ];

    const client = {
      executeQuery: ({ variables }: { variables: Record<string, unknown> }) => {
        if ("query" in variables) {
          return fromValue({ data: { search: searchDecisions } });
        }
        return fromValue({ data: { decisions: sampleDecisions } });
      },
      executeMutation: () => never,
      executeSubscription: () => never,
    } as never;

    render(
      <Provider value={client}>
        <DecisionList />
      </Provider>,
    );

    // Initially shows regular decisions
    expect(screen.getByText("Use GraphQL")).toBeDefined();

    const searchInput = screen.getByPlaceholderText("Search decisions...");
    fireEvent.change(searchInput, { target: { value: "search" } });

    // Advance past the 300ms debounce
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByText("Search Result Decision")).toBeDefined();

    vi.useRealTimers();
  });
});
