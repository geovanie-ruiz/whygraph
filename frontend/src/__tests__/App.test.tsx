import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../App";

describe("App", () => {
  it("renders the app title", () => {
    render(<App />);
    expect(screen.getByText("whygraph")).toBeDefined();
  });

  it("shows graph placeholder", () => {
    render(<App />);
    expect(screen.getByText("Graph view coming soon")).toBeDefined();
  });

  it("shows entity count", () => {
    render(<App />);
    expect(screen.getByText("Entities:")).toBeDefined();
  });
});
