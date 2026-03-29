import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "urql";
import { fromValue, never } from "wonka";
import { StaleRefBadge } from "../components/StaleRefBadge.js";

function mockClient(
  validationErrors: Array<{
    entityId: string;
    errors: Array<{ field: string; message: string; severity: string }>;
  }>,
  mutationFn?: () => ReturnType<typeof fromValue>,
) {
  return {
    executeQuery: () =>
      fromValue({
        data: { validationErrors },
      }),
    executeMutation: mutationFn ?? (() => never),
    executeSubscription: () => fromValue({ data: {} }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("StaleRefBadge", () => {
  it("renders nothing when query returns null data (uses [] fallback)", () => {
    const client = {
      executeQuery: () => fromValue({ data: null }),
      executeMutation: () => never,
      executeSubscription: () => fromValue({ data: {} }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const onChange = vi.fn();
    const { container } = render(
      <Provider value={client}>
        <StaleRefBadge onStaleRefIdsChange={onChange} />
      </Provider>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when no stale refs", () => {
    const client = mockClient([]);
    const onChange = vi.fn();
    const { container } = render(
      <Provider value={client}>
        <StaleRefBadge onStaleRefIdsChange={onChange} />
      </Provider>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders warning badge for stale refs", () => {
    const client = mockClient([
      {
        entityId: "node-abc123",
        errors: [
          { field: "refs", message: "file not found: /old/path.ts", severity: "warning" },
        ],
      },
    ]);
    const onChange = vi.fn();
    render(
      <Provider value={client}>
        <StaleRefBadge onStaleRefIdsChange={onChange} />
      </Provider>,
    );
    expect(screen.getByTestId("stale-ref-node-abc123")).toBeDefined();
  });

  it("modal opens on click", () => {
    const client = mockClient([
      {
        entityId: "node-abc123",
        errors: [
          { field: "refs", message: "file not found: /old/path.ts", severity: "warning" },
        ],
      },
    ]);
    const onChange = vi.fn();
    render(
      <Provider value={client}>
        <StaleRefBadge onStaleRefIdsChange={onChange} />
      </Provider>,
    );
    fireEvent.click(screen.getByTestId("stale-ref-node-abc123"));
    expect(screen.getByTestId("stale-ref-modal")).toBeDefined();
    expect(screen.getByText("Fix Stale Reference")).toBeDefined();
  });

  it("modal closes on cancel", () => {
    const client = mockClient([
      {
        entityId: "node-abc123",
        errors: [
          { field: "refs", message: "file not found: /old/path.ts", severity: "warning" },
        ],
      },
    ]);
    const onChange = vi.fn();
    render(
      <Provider value={client}>
        <StaleRefBadge onStaleRefIdsChange={onChange} />
      </Provider>,
    );
    fireEvent.click(screen.getByTestId("stale-ref-node-abc123"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByTestId("stale-ref-modal")).toBeNull();
  });

  it("submit with empty path is a no-op (mutation not called)", () => {
    const mutationFn = vi.fn(() =>
      fromValue({ data: { updateEntity: { id: "node-abc123" } } }),
    );
    const client = mockClient(
      [
        {
          entityId: "node-abc123",
          errors: [
            { field: "refs", message: "file not found: /old/path.ts", severity: "warning" },
          ],
        },
      ],
      mutationFn,
    );
    const onChange = vi.fn();
    render(
      <Provider value={client}>
        <StaleRefBadge onStaleRefIdsChange={onChange} />
      </Provider>,
    );
    fireEvent.click(screen.getByTestId("stale-ref-node-abc123"));
    // Leave the path input blank and click Submit
    fireEvent.click(screen.getByTestId("stale-ref-submit"));
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it("submit calls mutation with new path", async () => {
    const mutationFn = vi.fn(() =>
      fromValue({ data: { updateEntity: { id: "node-abc123" } } }),
    );
    const client = mockClient(
      [
        {
          entityId: "node-abc123",
          errors: [
            { field: "refs", message: "file not found: /old/path.ts", severity: "warning" },
          ],
        },
      ],
      mutationFn,
    );
    const onChange = vi.fn();
    render(
      <Provider value={client}>
        <StaleRefBadge onStaleRefIdsChange={onChange} />
      </Provider>,
    );
    fireEvent.click(screen.getByTestId("stale-ref-node-abc123"));
    const input = screen.getByLabelText("New file path:");
    fireEvent.change(input, { target: { value: "/src/new/path.ts" } });
    fireEvent.click(screen.getByTestId("stale-ref-submit"));
    expect(mutationFn).toHaveBeenCalled();
  });
});
