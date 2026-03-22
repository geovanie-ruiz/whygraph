import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  loadReviews,
  appendReview,
  dismissReview,
  autoDismissForNodes,
} from "../../src/staging/reviews.js";
import type { ReviewEntry } from "../../src/core/types.js";

describe("reviews", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "whygraph-reviews-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("loadReviews", () => {
    it("returns empty array when file does not exist", async () => {
      const result = await loadReviews(tmpDir);
      expect(result).toEqual([]);
    });

    it("parses JSONL file with multiple entries", async () => {
      const entries: ReviewEntry[] = [
        {
          id: "r1",
          newDecisionId: "d1",
          existingDecisionId: "d2",
          sharedNodeIds: ["n1"],
          status: "pending",
        },
        {
          id: "r2",
          newDecisionId: "d3",
          existingDecisionId: "d4",
          sharedNodeIds: ["n2", "n3"],
          status: "pending",
        },
      ];
      const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      fs.writeFileSync(path.join(tmpDir, "reviews.jsonl"), content);

      const result = await loadReviews(tmpDir);
      expect(result).toEqual(entries);
    });

    it("returns empty array for empty file", async () => {
      fs.writeFileSync(path.join(tmpDir, "reviews.jsonl"), "");
      const result = await loadReviews(tmpDir);
      expect(result).toEqual([]);
    });
  });

  describe("appendReview", () => {
    it("assigns a UUID id and appends to file", async () => {
      const review: ReviewEntry = {
        id: "",
        newDecisionId: "d1",
        existingDecisionId: "d2",
        sharedNodeIds: ["n1"],
        status: "pending",
      };
      await appendReview(tmpDir, review);

      const result = await loadReviews(tmpDir);
      expect(result).toHaveLength(1);
      expect(result[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(result[0].newDecisionId).toBe("d1");
    });

    it("appends to existing entries without overwriting", async () => {
      const review1: ReviewEntry = {
        id: "",
        newDecisionId: "d1",
        existingDecisionId: "d2",
        sharedNodeIds: ["n1"],
        status: "pending",
      };
      const review2: ReviewEntry = {
        id: "",
        newDecisionId: "d3",
        existingDecisionId: "d4",
        sharedNodeIds: ["n2"],
        status: "pending",
      };
      await appendReview(tmpDir, review1);
      await appendReview(tmpDir, review2);

      const result = await loadReviews(tmpDir);
      expect(result).toHaveLength(2);
      expect(result[0].id).not.toBe(result[1].id);
    });
  });

  describe("dismissReview", () => {
    it("removes specific entry by id", async () => {
      const entries: ReviewEntry[] = [
        {
          id: "keep-me",
          newDecisionId: "d1",
          existingDecisionId: "d2",
          sharedNodeIds: ["n1"],
          status: "pending",
        },
        {
          id: "remove-me",
          newDecisionId: "d3",
          existingDecisionId: "d4",
          sharedNodeIds: ["n2"],
          status: "pending",
        },
      ];
      const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      fs.writeFileSync(path.join(tmpDir, "reviews.jsonl"), content);

      await dismissReview(tmpDir, "remove-me");

      const result = await loadReviews(tmpDir);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("keep-me");
    });

    it("does nothing if review id not found", async () => {
      const entries: ReviewEntry[] = [
        {
          id: "keep-me",
          newDecisionId: "d1",
          existingDecisionId: "d2",
          sharedNodeIds: ["n1"],
          status: "pending",
        },
      ];
      const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      fs.writeFileSync(path.join(tmpDir, "reviews.jsonl"), content);

      await dismissReview(tmpDir, "nonexistent");

      const result = await loadReviews(tmpDir);
      expect(result).toHaveLength(1);
    });
  });

  describe("autoDismissForNodes", () => {
    it("removes reviews referencing given node IDs", async () => {
      const entries: ReviewEntry[] = [
        {
          id: "r1",
          newDecisionId: "d1",
          existingDecisionId: "d2",
          sharedNodeIds: ["n1", "n2"],
          status: "pending",
        },
        {
          id: "r2",
          newDecisionId: "d3",
          existingDecisionId: "d4",
          sharedNodeIds: ["n3"],
          status: "pending",
        },
        {
          id: "r3",
          newDecisionId: "d5",
          existingDecisionId: "d6",
          sharedNodeIds: ["n4", "n1"],
          status: "pending",
        },
      ];
      const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      fs.writeFileSync(path.join(tmpDir, "reviews.jsonl"), content);

      await autoDismissForNodes(tmpDir, ["n1"]);

      const result = await loadReviews(tmpDir);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("r2");
    });

    it("handles missing file gracefully", async () => {
      await autoDismissForNodes(tmpDir, ["n1"]);
      // Should not throw
    });

    it("handles empty node list without removing anything", async () => {
      const entries: ReviewEntry[] = [
        {
          id: "r1",
          newDecisionId: "d1",
          existingDecisionId: "d2",
          sharedNodeIds: ["n1"],
          status: "pending",
        },
      ];
      const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      fs.writeFileSync(path.join(tmpDir, "reviews.jsonl"), content);

      await autoDismissForNodes(tmpDir, []);

      const result = await loadReviews(tmpDir);
      expect(result).toHaveLength(1);
    });
  });
});
