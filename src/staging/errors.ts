import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ErrorEntry } from "../core/types.js";

const ERRORS_FILE = "errors.jsonl";

export async function loadErrors(whygraphDir: string): Promise<ErrorEntry[]> {
  const filePath = path.join(whygraphDir, ERRORS_FILE);
  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch {
    return [];
  }
  const trimmed = content.trim();
  if (trimmed === "") return [];
  return trimmed.split("\n").map((line) => JSON.parse(line) as ErrorEntry);
}

export async function writeErrors(
  whygraphDir: string,
  errors: ErrorEntry[],
): Promise<void> {
  const filePath = path.join(whygraphDir, ERRORS_FILE);
  const content =
    errors.length === 0 ? "" : errors.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await fs.writeFile(filePath, content, "utf-8");
}

export async function clearErrors(whygraphDir: string): Promise<void> {
  const filePath = path.join(whygraphDir, ERRORS_FILE);
  await fs.writeFile(filePath, "", "utf-8");
}
