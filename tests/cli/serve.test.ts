import { describe, it, expect } from "vitest";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { findWhygraphDir, runServe } from "../../src/cli/commands/serve.js";

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "whygraph-serve-test-"));
}

describe("findWhygraphDir", () => {
  it("finds .whygraph in the given directory", async () => {
    const dir = await makeTempDir();
    await fs.mkdir(path.join(dir, ".whygraph"), { recursive: true });

    const result = findWhygraphDir(dir);
    expect(result).toBe(dir);
    fsSync.rmSync(dir, { recursive: true, force: true });
  });

  it("walks up to find .whygraph in parent", async () => {
    const parentDir = await makeTempDir();
    await fs.mkdir(path.join(parentDir, ".whygraph"), { recursive: true });
    const childDir = path.join(parentDir, "src", "deep");
    await fs.mkdir(childDir, { recursive: true });

    const result = findWhygraphDir(childDir);
    expect(result).toBe(parentDir);
    fsSync.rmSync(parentDir, { recursive: true, force: true });
  });

  it("returns null when no .whygraph exists", async () => {
    const dir = await makeTempDir();
    const result = findWhygraphDir(dir);
    expect(result).toBeNull();
    fsSync.rmSync(dir, { recursive: true, force: true });
  });
});

describe("runServe", () => {
  it("throws when .whygraph not found", async () => {
    const dir = await makeTempDir();
    try {
      await expect(runServe(dir)).rejects.toThrow(/not found/);
    } finally {
      fsSync.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("starts server and returns url, port, entities, stop", async () => {
    const dir = await makeTempDir();
    const whygraphDir = path.join(dir, ".whygraph");
    await fs.mkdir(path.join(whygraphDir, "graph"), { recursive: true });

    const result = await runServe(dir, { port: 0 });
    try {
      expect(result.url).toMatch(/^http:\/\/localhost:/);
      expect(typeof result.entities).toBe("number");
      expect(typeof result.port).toBe("number");
      expect(typeof result.stop).toBe("function");
    } finally {
      await result.stop();
      fsSync.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads entities from graph dir on startup", async () => {
    const dir = await makeTempDir();
    const whygraphDir = path.join(dir, ".whygraph");
    const graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });

    const entityMd = `---
id: wg-srv1
label: Feature
name: ServeTest
status: active
created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---
`;
    await fs.writeFile(path.join(graphDir, "wg-srv1.md"), entityMd);

    const result = await runServe(dir, { port: 0 });
    try {
      expect(result.entities).toBe(1);
    } finally {
      await result.stop();
      fsSync.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("file watcher removes entity when file is deleted", async () => {
    const dir = await makeTempDir();
    const whygraphDir = path.join(dir, ".whygraph");
    const graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });

    const entityMd = `---
id: wg-del1
label: Feature
name: DeleteTest
status: active
created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---
`;
    const entityPath = path.join(graphDir, "wg-del1.md");
    await fs.writeFile(entityPath, entityMd);

    const result = await runServe(dir, { port: 19978 });

    // Wait for chokidar to be ready
    await new Promise((r) => setTimeout(r, 300));

    // Delete the entity file
    await fs.unlink(entityPath);

    // Wait for watcher debounce
    await new Promise((r) => setTimeout(r, 800));

    try {
      const res = await fetch(`http://localhost:19978/api/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `{ entity(id: "wg-del1") { __typename } }` }),
      });
      const body = await res.json() as { data?: { entity?: unknown } };
      expect(body.data?.entity).toBeNull();
    } finally {
      await result.stop();
      fsSync.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("file watcher picks up new entity after serve starts", async () => {
    const dir = await makeTempDir();
    const whygraphDir = path.join(dir, ".whygraph");
    const graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });

    const result = await runServe(dir, { port: 19979 });

    // Wait for chokidar to be ready
    await new Promise((r) => setTimeout(r, 300));

    const entityMd = `---
id: wg-watch1
label: Feature
name: WatchTest
status: active
created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---
`;
    await fs.writeFile(path.join(graphDir, "wg-watch1.md"), entityMd);

    // Wait for watcher debounce + file read
    await new Promise((r) => setTimeout(r, 800));

    try {
      // The entity should be available via the server
      const res = await fetch(`http://localhost:19979/api/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `{ entity(id: "wg-watch1") { __typename } }` }),
      });
      const body = await res.json() as { data?: { entity?: unknown } };
      expect(body.data?.entity).toBeDefined();
    } finally {
      await result.stop();
      fsSync.rmSync(dir, { recursive: true, force: true });
    }
  });
});
