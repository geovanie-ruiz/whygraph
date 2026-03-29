import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../lib/theme.js";

describe("ThemeProvider", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to dark theme", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });
    expect(result.current.theme).toBe("dark");
  });

  it("toggle switches theme from dark to light", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });
    expect(result.current.theme).toBe("dark");

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe("light");
  });

  it("toggle switches theme from light back to dark", () => {
    localStorage.setItem("whygraph-theme", "light");
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });
    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe("dark");
  });

  it("reads stored theme from localStorage", () => {
    localStorage.setItem("whygraph-theme", "light");

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });
    expect(result.current.theme).toBe("light");
  });

  it("handles localStorage.getItem failure gracefully", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });
    expect(result.current.theme).toBe("dark");

    spy.mockRestore();
  });

  it("default context toggle is a callable no-op (exercises the context default value)", () => {
    // useTheme without ThemeProvider returns the default context value,
    // which has toggle: () => {}. Calling it must not throw.
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
    expect(() => result.current.toggle()).not.toThrow();
  });

  it("handles localStorage.setItem failure gracefully", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe("light");

    spy.mockRestore();
  });
});
