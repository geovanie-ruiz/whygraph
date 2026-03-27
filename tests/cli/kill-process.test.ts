/**
 * Tests for killProcessOnPort with mocked execSync.
 * Separate file needed so vi.mock hoisting applies to node:child_process.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

import { execSync } from "node:child_process";
import { killProcessOnPort } from "../../src/cli/commands/server-utils.js";

describe("killProcessOnPort", () => {
  it("returns true and kills process when found on port", () => {
    vi.mocked(execSync)
      .mockReturnValueOnce("12345\n67890" as unknown as Buffer) // lsof returns pids
      .mockReturnValue(undefined as unknown as Buffer); // kill succeeds

    const result = killProcessOnPort(4777);

    expect(result).toBe(true);
    expect(execSync).toHaveBeenCalledWith("lsof -ti:4777", { encoding: "utf-8" });
    expect(execSync).toHaveBeenCalledWith("kill 12345");
    expect(execSync).toHaveBeenCalledWith("kill 67890");
  });

  it("returns false when no process on port (lsof returns empty)", () => {
    vi.mocked(execSync).mockReturnValueOnce("" as unknown as Buffer);

    const result = killProcessOnPort(4778);

    expect(result).toBe(false);
  });

  it("returns false when lsof throws (no process)", () => {
    vi.mocked(execSync).mockImplementationOnce(() => {
      throw new Error("lsof: no process");
    });

    const result = killProcessOnPort(4779);

    expect(result).toBe(false);
  });

  it("continues killing other pids when one kill throws", () => {
    vi.mocked(execSync)
      .mockReturnValueOnce("111\n222" as unknown as Buffer) // lsof
      .mockImplementationOnce(() => { throw new Error("no such process"); }) // kill 111 fails
      .mockReturnValue(undefined as unknown as Buffer); // kill 222 succeeds

    const result = killProcessOnPort(4780);

    expect(result).toBe(true);
  });
});
