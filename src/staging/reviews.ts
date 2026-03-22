import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type { ReviewEntry } from "../core/types.js";

const REVIEWS_FILE = "reviews.jsonl";

export async function loadReviews(
  whygraphDir: string,
): Promise<ReviewEntry[]> {
  const filePath = path.join(whygraphDir, REVIEWS_FILE);
  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch {
    return [];
  }
  const trimmed = content.trim();
  if (trimmed === "") return [];
  return trimmed.split("\n").map((line) => JSON.parse(line) as ReviewEntry);
}

export async function appendReview(
  whygraphDir: string,
  review: ReviewEntry,
): Promise<void> {
  const filePath = path.join(whygraphDir, REVIEWS_FILE);
  const entry: ReviewEntry = { ...review, id: randomUUID() };
  await fs.appendFile(filePath, JSON.stringify(entry) + "\n", "utf-8");
}

export async function dismissReview(
  whygraphDir: string,
  reviewId: string,
): Promise<void> {
  const reviews = await loadReviews(whygraphDir);
  const filtered = reviews.filter((r) => r.id !== reviewId);
  await writeReviews(whygraphDir, filtered);
}

export async function autoDismissForNodes(
  whygraphDir: string,
  nodeIds: string[],
): Promise<void> {
  if (nodeIds.length === 0) return;
  const reviews = await loadReviews(whygraphDir);
  const nodeIdSet = new Set(nodeIds);
  const filtered = reviews.filter(
    (r) => !r.sharedNodeIds.some((id) => nodeIdSet.has(id)),
  );
  await writeReviews(whygraphDir, filtered);
}

async function writeReviews(
  whygraphDir: string,
  reviews: ReviewEntry[],
): Promise<void> {
  const filePath = path.join(whygraphDir, REVIEWS_FILE);
  const content =
    reviews.length === 0
      ? ""
      : reviews.map((r) => JSON.stringify(r)).join("\n") + "\n";
  await fs.writeFile(filePath, content, "utf-8");
}
