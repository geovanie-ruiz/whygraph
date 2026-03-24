import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagFilter } from "../components/TagFilter.js";

const ALL_TAGS = ["arch", "data", "security", "performance", "integration", "infra", "ux"];

describe("TagFilter", () => {
  it("renders all tag options", () => {
    const onChange = vi.fn();
    render(<TagFilter onTagsChange={onChange} />);
    for (const tag of ALL_TAGS) {
      expect(screen.getByRole("checkbox", { name: tag })).toBeDefined();
    }
  });

  it("selecting a tag calls filter callback", () => {
    const onChange = vi.fn();
    render(<TagFilter onTagsChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "arch" }));
    expect(onChange).toHaveBeenCalledWith(new Set(["arch"]));
  });

  it("selecting multiple tags uses OR logic", () => {
    const onChange = vi.fn();
    render(<TagFilter onTagsChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "arch" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "security" }));
    expect(onChange).toHaveBeenLastCalledWith(new Set(["arch", "security"]));
  });

  it("deselecting a tag removes it from selection", () => {
    const onChange = vi.fn();
    render(<TagFilter onTagsChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "data" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "data" }));
    expect(onChange).toHaveBeenLastCalledWith(new Set());
  });

  it("shows clear button when tags are selected", () => {
    const onChange = vi.fn();
    render(<TagFilter onTagsChange={onChange} />);
    expect(screen.queryByText("Clear")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "ux" }));
    expect(screen.getByText("Clear")).toBeDefined();
  });

  it("clear button resets all selections", () => {
    const onChange = vi.fn();
    render(<TagFilter onTagsChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "arch" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "infra" }));
    fireEvent.click(screen.getByText("Clear"));
    expect(onChange).toHaveBeenLastCalledWith(new Set());
  });
});
