import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../App";

describe("App", () => {
  it("renders the app title", () => {
    render(<App />);
    expect(screen.getByText("whygraph")).toBeDefined();
  });

  it("renders graph view SVG", () => {
    const { container } = render(<App />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("shows entity count", () => {
    render(<App />);
    expect(screen.getByText("Entities:")).toBeDefined();
  });
});
