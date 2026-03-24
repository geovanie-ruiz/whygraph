import { customAlphabet } from "nanoid";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const DEFAULT_PREFIX = "wg-";
const DEFAULT_LENGTH = 4;
const MAX_SLUG_LENGTH = 50;

export interface IdOptions {
  prefix?: string;
  length?: number;
}

export function generateId(options?: IdOptions): string {
  const prefix = options?.prefix ?? DEFAULT_PREFIX;
  const length = options?.length ?? DEFAULT_LENGTH;
  const nanoid = customAlphabet(ALPHABET, length);
  return `${prefix}${nanoid()}`;
}

export function slugify(title: string): string {
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.slice(0, MAX_SLUG_LENGTH).replace(/-$/, "");
  }

  return slug;
}

export function toFilename(id: string, title: string): string {
  const slug = slugify(title);
  if (!slug) {
    return `${id}.md`;
  }
  return `${id}--${slug}.md`;
}

export function parseFilename(filename: string): string | null {
  // Strip directory path
  const base = filename.includes("/")
    ? filename.slice(filename.lastIndexOf("/") + 1)
    : filename;

  // Must end with .md
  if (!base.endsWith(".md")) {
    return null;
  }

  const withoutExt = base.slice(0, -3);

  // Try double-dash split first
  const ddIndex = withoutExt.indexOf("--");
  const id = ddIndex >= 0 ? withoutExt.slice(0, ddIndex) : withoutExt;

  // Validate ID looks like prefix + nanoid
  if (!/^[a-z]+-[0-9a-z]+$/.test(id)) {
    return null;
  }

  return id;
}
