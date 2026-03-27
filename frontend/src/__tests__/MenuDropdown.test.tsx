import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Provider } from "urql";
import { fromValue } from "wonka";
import { MenuDropdown } from "../components/MenuDropdown.js";

const mockClient = {
  executeQuery: () => fromValue({ data: null }),
  executeMutation: () => fromValue({ data: {} }),
  executeSubscription: () => fromValue({ data: {} }),
} as any;

describe("MenuDropdown", () => {
  it("Escape key closes menu when open", () => {
    const onClose = vi.fn();

    render(
      <Provider value={mockClient}>
        <MenuDropdown
          open={true}
          onClose={onClose}
          onTagsChange={vi.fn()}
          onGapIdsChange={vi.fn()}
          onStaleRefIdsChange={vi.fn()}
        />
      </Provider>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on Escape when not open", () => {
    const onClose = vi.fn();

    render(
      <Provider value={mockClient}>
        <MenuDropdown
          open={false}
          onClose={onClose}
          onTagsChange={vi.fn()}
          onGapIdsChange={vi.fn()}
          onStaleRefIdsChange={vi.fn()}
        />
      </Provider>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });
});
