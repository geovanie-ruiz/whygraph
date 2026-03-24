import { describe, it, expect } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { findWhygraphDir } from "../../src/cli/commands/serve.js";

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "whygraph-serve-test-"));
}

describe("findWhygraphDir", () => {
  it("finds .whygraph in the given directory", async () => {
    const dir = await makeTempDir();
    await fs.mkdir(path.join(dir, ".whygraph"), { recursive: true });

    const result = findWhygraphDir(dir);
    expect(result).toBe(dir);
  });

  it("walks up to find .whygraph in parent", async () => {
    const parentDir = await makeTempDir();
    await fs.mkdir(path.join(parentDir, ".whygraph"), { recursive: true });
    const childDir = path.join(parentDir, "src", "deep");
    await fs.mkdir(childDir, { recursive: true });

    const result = findWhygraphDir(childDir);
    expect(result).toBe(parentDir);
  });

  it("returns null when no .whygraph exists", async () => {
    const dir = await makeTempDir();
    // No .whygraph created
    const result = findWhygraphDir(dir);
    expect(result).toBeNull();
  });
});
