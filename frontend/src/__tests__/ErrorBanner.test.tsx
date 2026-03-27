import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { Provider } from "urql";
import { fromValue } from "wonka";
import { ErrorBanner, useValidationErrors } from "../components/ErrorBanner.js";
import type { ErrorBannerProps } from "../components/ErrorBanner.js";
import type { ReactNode } from "react";

function mockClient(data: Record<string, unknown>) {
  return {
    executeQuery: () => fromValue({ data }),
    executeMutation: () => fromValue({ data: {} }),
    executeSubscription: () => fromValue({ data: {} }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("ErrorBanner", () => {
  it("returns null when there are no errors", () => {
    const { container } = render(
      <ErrorBanner nodeErrors={new Map()} generalErrors={[]} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows agent-needed errors for non-CLI-resolvable fields", () => {
    const nodeErrors: ErrorBannerProps["nodeErrors"] = new Map([
      ["wg-0001", [{ field: "refs", message: "bad ref", severity: "error" }]],
    ]);
    render(<ErrorBanner nodeErrors={nodeErrors} generalErrors={[]} />);
    expect(screen.getByText(/1 entity issue:/)).toBeDefined();
    expect(screen.getByText(/1 need an agent/)).toBeDefined();
  });

  it("shows CLI-resolvable errors for CLI-resolvable fields", () => {
    const nodeErrors: ErrorBannerProps["nodeErrors"] = new Map([
      ["wg-0001", [{ field: "tags", message: "invalid tag", severity: "warning" }]],
    ]);
    render(<ErrorBanner nodeErrors={nodeErrors} generalErrors={[]} />);
    expect(screen.getByText(/1 entity issue:/)).toBeDefined();
    expect(screen.getByText(/1 resolvable via whygraph issues/)).toBeDefined();
  });

  it("shows both parts for mixed errors", () => {
    const nodeErrors: ErrorBannerProps["nodeErrors"] = new Map([
      ["wg-0001", [{ field: "refs", message: "bad ref", severity: "error" }]],
      ["wg-0002", [{ field: "tags", message: "invalid tag", severity: "warning" }]],
    ]);
    render(<ErrorBanner nodeErrors={nodeErrors} generalErrors={[]} />);
    expect(screen.getByText(/2 entity issues:/)).toBeDefined();
    expect(screen.getByText(/1 need an agent/)).toBeDefined();
    expect(screen.getByText(/1 resolvable via whygraph issues/)).toBeDefined();
  });

  it("counts generalErrors in both agent-needed and CLI-resolvable buckets", () => {
    const generalErrors = [
      { entityId: "wg-unknown1", errors: [{ field: "refs", message: "bad", severity: "error" }] },
      { entityId: "wg-unknown2", errors: [{ field: "affects", message: "bad", severity: "warning" }] },
    ];
    render(<ErrorBanner nodeErrors={new Map()} generalErrors={generalErrors} />);
    expect(screen.getByText(/2 entity issues:/)).toBeDefined();
    expect(screen.getByText(/1 need an agent/)).toBeDefined();
    expect(screen.getByText(/1 resolvable via whygraph issues/)).toBeDefined();
  });

  it("uses singular 'issue' for a single error", () => {
    const generalErrors = [
      { entityId: "wg-solo", errors: [{ field: "date", message: "bad date", severity: "error" }] },
    ];
    render(<ErrorBanner nodeErrors={new Map()} generalErrors={generalErrors} />);
    expect(screen.getByText(/1 entity issue:/)).toBeDefined();
    // Singular "issue" not "issues" before the colon
    expect(screen.getByText(/1 entity issue:/).textContent).toMatch(/1 entity issue:/);
    expect(screen.getByText(/1 entity issue:/).textContent).not.toMatch(/1 entity issues:/);
  });
});

describe("useValidationErrors", () => {
  it("splits validation errors into nodeErrors and generalErrors", () => {
    const client = mockClient({
      validationErrors: [
        { entityId: "wg-0001", errors: [{ field: "tags", message: "bad", severity: "error" }] },
        { entityId: "wg-0002", errors: [{ field: "refs", message: "bad", severity: "warning" }] },
        { entityId: "wg-unknown", errors: [{ field: "date", message: "bad", severity: "error" }] },
      ],
    });

    const knownIds = new Set(["wg-0001", "wg-0002"]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider value={client}>{children}</Provider>
    );

    const { result } = renderHook(() => useValidationErrors(knownIds), { wrapper });

    expect(result.current.nodeErrors.size).toBe(2);
    expect(result.current.nodeErrors.get("wg-0001")).toEqual([
      { field: "tags", message: "bad", severity: "error" },
    ]);
    expect(result.current.nodeErrors.get("wg-0002")).toEqual([
      { field: "refs", message: "bad", severity: "warning" },
    ]);
    expect(result.current.generalErrors).toEqual([
      { entityId: "wg-unknown", errors: [{ field: "date", message: "bad", severity: "error" }] },
    ]);
  });

  it("returns empty results when query has no data", () => {
    const client = mockClient({});

    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider value={client}>{children}</Provider>
    );

    const { result } = renderHook(() => useValidationErrors(new Set(["wg-0001"])), { wrapper });

    expect(result.current.nodeErrors.size).toBe(0);
    expect(result.current.generalErrors).toEqual([]);
  });
});
