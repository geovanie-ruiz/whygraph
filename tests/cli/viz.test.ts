import { describe, it, expect } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { runViz } from "../../src/cli/commands/viz.js";

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "whygraph-viz-test-"));
}

describe("runViz", () => {
  it("throws if no .whygraph/ found", async () => {
    const dir = await makeTempDir();

    await expect(runViz(dir)).rejects.toThrow(
      ".whygraph/ not found",
    );
  });
});
