import { describe, it, expect } from "vitest";
import {
  generateId,
  slugify,
  toFilename,
  parseFilename,
} from "../../src/entity/id.js";

describe("generateId", () => {
  it("returns a string with the correct prefix and length", () => {
    const id = generateId();
    expect(id).toMatch(/^wg-[0-9a-z]{4}$/);
  });

  it("respects custom prefix and length", () => {
    const id = generateId({ prefix: "test-", length: 6 });
    expect(id).toMatch(/^test-[0-9a-z]{6}$/);
  });

  it("generates unique IDs on successive calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    // With 36^4 possibilities, 50 calls should all be unique
    expect(ids.size).toBe(50);
  });
});

describe("slugify", () => {
  it("converts titles to lowercase hyphen-separated slugs", () => {
    expect(slugify("Use WebSockets for Live Updates")).toBe(
      "use-websockets-for-live-updates",
    );
  });

  it("replaces non-alphanumeric characters with hyphens", () => {
    expect(slugify("Hello, World! (2026)")).toBe("hello-world-2026");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("foo---bar")).toBe("foo-bar");
  });

  it("trims hyphens from ends", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("truncates to 50 characters", () => {
    const long = "a".repeat(60);
    const result = slugify(long);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("does not end with a hyphen after truncation", () => {
    // 50 chars of 'a' then a 'b', with a hyphen at position 50
    const title = "a".repeat(49) + " b";
    const result = slugify(title);
    expect(result).not.toMatch(/-$/);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("returns empty string for empty title", () => {
    expect(slugify("")).toBe("");
  });

  it("handles all-special-character input", () => {
    expect(slugify("!!!@@@###")).toBe("");
  });
});

describe("toFilename", () => {
  it("composes id and slug with double-dash separator and .md extension", () => {
    expect(toFilename("wg-a1b2", "Use JWT Tokens")).toBe(
      "wg-a1b2--use-jwt-tokens.md",
    );
  });

  it("handles empty title by omitting slug", () => {
    expect(toFilename("wg-a1b2", "")).toBe("wg-a1b2.md");
  });
});

describe("parseFilename", () => {
  it("extracts id from filename with double-dash separator", () => {
    expect(parseFilename("wg-a1b2--use-jwt-tokens.md")).toBe("wg-a1b2");
  });

  it("extracts id from filename without slug", () => {
    expect(parseFilename("wg-a1b2.md")).toBe("wg-a1b2");
  });

  it("handles filenames with directories", () => {
    expect(parseFilename("decisions/wg-a1b2--use-jwt.md")).toBe("wg-a1b2");
  });

  it("returns null for invalid filenames", () => {
    expect(parseFilename("not-a-valid-file.txt")).toBeNull();
  });

  it("returns null for .md files with invalid id format", () => {
    // Uppercase in id doesn't match /^[a-z]+-[0-9a-z]+$/
    expect(parseFilename("INVALID-file.md")).toBeNull();
  });
});
