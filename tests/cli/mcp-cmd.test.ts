import { describe, it, expect, vi, afterEach } from "vitest";
import { Command } from "commander";

describe("registerMcpCommand", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers the mcp command on the program", async () => {
    const { registerMcpCommand } = await import("../../src/cli/commands/mcp.js");
    const program = new Command();
    registerMcpCommand(program);
    const cmd = program.commands.find((c) => c.name() === "mcp");
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain("MCP");
  });
});
