import { describe, it, expect, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { ThemeToggle } from "../components/ThemeToggle.js";
import { ThemeProvider } from "../lib/theme.js";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  it("shows sun icon when theme is light", () => {
    localStorage.setItem("whygraph-theme", "light");
    const { container } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const icon = container.querySelector(".theme-toggle__icon");
    expect(icon?.textContent).toBe("\u2600"); // ☀
  });

  it("shows moon icon when theme is dark", () => {
    // Default theme is dark; no localStorage entry needed
    const { container } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const icon = container.querySelector(".theme-toggle__icon");
    expect(icon?.textContent).toBe("\u263E"); // ☾
  });
});
