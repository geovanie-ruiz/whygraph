import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "urql";
import { fromValue } from "wonka";
import { GapHighlight } from "../components/GapHighlight.js";

function mockClient(gaps: Array<{ id: string; label: string; name: string }>) {
  return {
    executeQuery: () =>
      fromValue({
        data: { gaps },
      }),
    executeMutation: () => fromValue({ data: {} }),
    executeSubscription: () => fromValue({ data: {} }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("GapHighlight", () => {
  it("renders toggle button", () => {
    const client = mockClient([]);
    const onChange = vi.fn();
    render(
      <Provider value={client}>
        <GapHighlight onGapIdsChange={onChange} />
      </Provider>,
    );
    expect(screen.getByRole("button", { name: /show gaps/i })).toBeDefined();
  });

  it("shows gap count", () => {
    const client = mockClient([
      { id: "feat-1", label: "Feature", name: "Auth" },
      { id: "comp-1", label: "Component", name: "Login" },
    ]);
    const onChange = vi.fn();
    render(
      <Provider value={client}>
        <GapHighlight onGapIdsChange={onChange} />
      </Provider>,
    );
    expect(screen.getByTestId("gap-count").textContent).toBe("2 gaps");
  });

  it("toggles gap highlighting", () => {
    const client = mockClient([
      { id: "feat-1", label: "Feature", name: "Auth" },
    ]);
    const onChange = vi.fn();
    render(
      <Provider value={client}>
        <GapHighlight onGapIdsChange={onChange} />
      </Provider>,
    );

    const button = screen.getByRole("button", { name: /show gaps/i });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: /hide gaps/i })).toBeDefined();
  });

  it("shows singular gap text for single gap", () => {
    const client = mockClient([
      { id: "feat-1", label: "Feature", name: "Auth" },
    ]);
    const onChange = vi.fn();
    render(
      <Provider value={client}>
        <GapHighlight onGapIdsChange={onChange} />
      </Provider>,
    );
    expect(screen.getByTestId("gap-count").textContent).toBe("1 gap");
  });
});
