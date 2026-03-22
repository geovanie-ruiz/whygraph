import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadErrors, writeErrors, clearErrors } from "../../src/staging/errors.js";
import type { ErrorEntry } from "../../src/core/types.js";

describe("errors", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "whygraph-errors-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("loadErrors", () => {
    it("returns empty array when file does not exist", async () => {
      const result = await loadErrors(tmpDir);
      expect(result).toEqual([]);
    });

    it("parses JSONL file with multiple entries", async () => {
      const entries: ErrorEntry[] = [
        { entry: "decision-1", error: "missing context", file: "staging/bead-1.md" },
        { entry: "feature-2", error: "invalid parent", file: "staging/bead-2.md" },
      ];
      const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      fs.writeFileSync(path.join(tmpDir, "errors.jsonl"), content);

      const result = await loadErrors(tmpDir);
      expect(result).toEqual(entries);
    });

    it("returns empty array for empty file", async () => {
      fs.writeFileSync(path.join(tmpDir, "errors.jsonl"), "");
      const result = await loadErrors(tmpDir);
      expect(result).toEqual([]);
    });
  });

  describe("writeErrors", () => {
    it("writes entries as JSONL", async () => {
      const entries: ErrorEntry[] = [
        { entry: "decision-1", error: "missing context", file: "staging/bead-1.md" },
      ];
      await writeErrors(tmpDir, entries);

      const content = fs.readFileSync(path.join(tmpDir, "errors.jsonl"), "utf-8");
      expect(content).toBe(JSON.stringify(entries[0]) + "\n");
    });

    it("writes multiple entries with newline separators", async () => {
      const entries: ErrorEntry[] = [
        { entry: "decision-1", error: "missing context", file: "staging/bead-1.md" },
        { entry: "feature-2", error: "invalid parent", file: "staging/bead-2.md" },
      ];
      await writeErrors(tmpDir, entries);

      const content = fs.readFileSync(path.join(tmpDir, "errors.jsonl"), "utf-8");
      const lines = content.trimEnd().split("\n");
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0])).toEqual(entries[0]);
      expect(JSON.parse(lines[1])).toEqual(entries[1]);
    });

    it("writes empty file for empty array", async () => {
      await writeErrors(tmpDir, []);
      const content = fs.readFileSync(path.join(tmpDir, "errors.jsonl"), "utf-8");
      expect(content).toBe("");
    });
  });

  describe("clearErrors", () => {
    it("empties existing file", async () => {
      const entries: ErrorEntry[] = [
        { entry: "decision-1", error: "missing context", file: "staging/bead-1.md" },
      ];
      await writeErrors(tmpDir, entries);
      await clearErrors(tmpDir);

      const content = fs.readFileSync(path.join(tmpDir, "errors.jsonl"), "utf-8");
      expect(content).toBe("");
    });

    it("creates empty file if missing", async () => {
      await clearErrors(tmpDir);
      const content = fs.readFileSync(path.join(tmpDir, "errors.jsonl"), "utf-8");
      expect(content).toBe("");
    });
  });
});
