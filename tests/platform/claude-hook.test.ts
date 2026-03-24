import { describe, it, expect } from "vitest";
import { generateSessionStartHook } from "../../src/platform/claude-hook.js";

describe("generateSessionStartHook", () => {
  it("includes health check", () => {
    const script = generateSessionStartHook("/path/to/.whygraph");
    expect(script).toContain("curl -s http://localhost:4777/api/health");
  });

  it("includes prime call", () => {
    const script = generateSessionStartHook("/path/to/.whygraph");
    expect(script).toContain("whygraph prime");
  });

  it("includes warning message when server not running", () => {
    const script = generateSessionStartHook("/path/to/.whygraph");
    expect(script).toContain("whygraph server is not running");
    expect(script).toContain("whygraph serve");
  });

  it("includes shebang line", () => {
    const script = generateSessionStartHook("/path/to/.whygraph");
    expect(script).toMatch(/^#!\/usr\/bin\/env bash/);
  });

  it("includes the whygraph dir in a comment", () => {
    const script = generateSessionStartHook("/my/project/.whygraph");
    expect(script).toContain("/my/project/.whygraph");
  });
});
