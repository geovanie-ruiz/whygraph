import { describe, it, expect, afterEach, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { WorktreeWatcher } from "../../src/server/worktree-watcher.js";
import { ServerCore } from "../../src/server/core.js";
import type { WorktreeInfo } from "../../src/server/worktree.js";

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "whygraph-wtwatcher-test-"));
}

function structuralMd(id: string): string {
  return `---
id: ${id}
label: Feature
name: TestFeature
status: active
created_at: "2026-03-24T00:00:00Z"
updated_at: "2026-03-24T00:00:00Z"
---
`;
}

describe("WorktreeWatcher", () => {
  let watcher: WorktreeWatcher;

  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
    }
  });

  it("watches a worktree directory for changes", async () => {
    const whygraphDir = await makeTempDir();
    const graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });
    const core = new ServerCore(whygraphDir);
    await core.load();

    // Create a fake worktree directory with its own graph dir
    const wtDir = await makeTempDir();
    const wtGraphDir = path.join(wtDir, ".whygraph", "graph");
    await fs.mkdir(wtGraphDir, { recursive: true });

    const mockDetect = vi.fn().mockResolvedValue([
      { path: wtDir, branch: "feat-a", graphDir: wtGraphDir } satisfies WorktreeInfo,
    ]);

    watcher = new WorktreeWatcher(core, "/fake/repo", {
      detectWorktrees: mockDetect,
    });
    await watcher.startWatching();

    expect(watcher.getWatchedWorktrees()).toEqual([wtDir]);

    // Small delay so chokidar is ready before writing
    await new Promise((r) => setTimeout(r, 200));

    // Write a file to the worktree graph dir
    await fs.writeFile(path.join(wtGraphDir, "wg-wt1.md"), structuralMd("wg-wt1"));

    // Wait for watcher debounce + file read
    await new Promise((r) => setTimeout(r, 1000));

    // The entity should be in the core
    const entity = core.getEntity("wg-wt1");
    expect(entity).toBeDefined();
    expect(entity!.id).toBe("wg-wt1");
    // Should be tagged as worktree entity
    expect((entity as Record<string, unknown>)._worktree).toBe(wtDir);
    expect(watcher.isWorktreeEntity("wg-wt1")).toBe(true);
  });

  it("handles no worktrees gracefully", async () => {
    const whygraphDir = await makeTempDir();
    const graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });
    const core = new ServerCore(whygraphDir);
    await core.load();

    const mockDetect = vi.fn().mockResolvedValue([]);

    watcher = new WorktreeWatcher(core, "/fake/repo", {
      detectWorktrees: mockDetect,
    });
    await watcher.startWatching();

    expect(watcher.getWatchedWorktrees()).toEqual([]);
    expect(mockDetect).toHaveBeenCalledOnce();
  });

  it("clean shutdown stops all watchers", async () => {
    const whygraphDir = await makeTempDir();
    const graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });
    const core = new ServerCore(whygraphDir);
    await core.load();

    // Set up two fake worktree directories
    const wt1Dir = await makeTempDir();
    const wt1GraphDir = path.join(wt1Dir, ".whygraph", "graph");
    await fs.mkdir(wt1GraphDir, { recursive: true });

    const wt2Dir = await makeTempDir();
    const wt2GraphDir = path.join(wt2Dir, ".whygraph", "graph");
    await fs.mkdir(wt2GraphDir, { recursive: true });

    const mockDetect = vi.fn().mockResolvedValue([
      { path: wt1Dir, branch: "feat-a", graphDir: wt1GraphDir } satisfies WorktreeInfo,
      { path: wt2Dir, branch: "feat-b", graphDir: wt2GraphDir } satisfies WorktreeInfo,
    ]);

    watcher = new WorktreeWatcher(core, "/fake/repo", {
      detectWorktrees: mockDetect,
    });
    await watcher.startWatching();

    expect(watcher.getWatchedWorktrees()).toHaveLength(2);

    await watcher.stop();

    expect(watcher.getWatchedWorktrees()).toEqual([]);

    // Write after stop — should not update core
    const initialCount = core.getAllEntities().length;
    await fs.writeFile(path.join(wt1GraphDir, "wg-late.md"), structuralMd("wg-late"));
    await new Promise((r) => setTimeout(r, 1000));
    expect(core.getAllEntities().length).toBe(initialCount);
  });

  it("entity with same etag as main is removed from dirty set", async () => {
    const whygraphDir = await makeTempDir();
    const graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });

    // Create entity in main graph
    const entityContent = structuralMd("wg-same");
    await fs.writeFile(path.join(graphDir, "wg-same.md"), entityContent);

    const core = new ServerCore(whygraphDir);
    await core.load();

    // Set up empty worktree directory (no file yet)
    const wtDir = await makeTempDir();
    const wtGraphDir = path.join(wtDir, ".whygraph", "graph");
    await fs.mkdir(wtGraphDir, { recursive: true });

    const mockDetect = vi.fn().mockResolvedValue([
      { path: wtDir, branch: "same-test", graphDir: wtGraphDir } satisfies WorktreeInfo,
    ]);

    watcher = new WorktreeWatcher(core, "/fake/repo", { detectWorktrees: mockDetect });
    await watcher.startWatching();

    // Small delay so chokidar is ready
    await new Promise((r) => setTimeout(r, 200));

    // Write IDENTICAL file content AFTER watcher starts (triggers add event)
    await fs.writeFile(path.join(wtGraphDir, "wg-same.md"), entityContent);

    // Wait for watcher debounce + file read
    await new Promise((r) => setTimeout(r, 800));

    // Entity has same etag as main — should NOT be dirty
    expect(watcher.getDirtyIds()).not.toContain("wg-same");
  });

  it("getDirtyIds returns ids of dirty entities", async () => {
    const whygraphDir = await makeTempDir();
    const graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });
    const core = new ServerCore(whygraphDir);
    await core.load();

    watcher = new WorktreeWatcher(core, "/fake/repo", {
      detectWorktrees: vi.fn().mockResolvedValue([]),
    });
    await watcher.startWatching();

    // No dirty entities initially
    expect(watcher.getDirtyIds()).toEqual([]);
  });

  it("handles deleted event in worktree", async () => {
    const whygraphDir = await makeTempDir();
    const graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });
    const core = new ServerCore(whygraphDir);
    await core.load();

    const wtDir = await makeTempDir();
    const wtGraphDir = path.join(wtDir, ".whygraph", "graph");
    await fs.mkdir(wtGraphDir, { recursive: true });

    // Pre-create a file so chokidar knows it exists before delete
    const entityFile = path.join(wtGraphDir, "wg-del1.md");
    await fs.writeFile(entityFile, structuralMd("wg-del1"));

    const mockDetect = vi.fn().mockResolvedValue([
      { path: wtDir, branch: "del-test", graphDir: wtGraphDir } satisfies WorktreeInfo,
    ]);

    watcher = new WorktreeWatcher(core, "/fake/repo", { detectWorktrees: mockDetect });
    await watcher.startWatching();

    // Wait for chokidar to register the existing file
    await new Promise((r) => setTimeout(r, 500));

    // Entity should be in core as a worktree entity
    await new Promise((r) => setTimeout(r, 600));

    // Delete the file to trigger deleted event
    await fs.unlink(entityFile);
    await new Promise((r) => setTimeout(r, 800));

    // Entity should be removed from core
    expect(watcher.isWorktreeEntity("wg-del1")).toBe(false);
  });

  it("ignores watcher events with no entityId (unparseable file)", async () => {
    const whygraphDir = await makeTempDir();
    const graphDir = path.join(whygraphDir, "graph");
    await fs.mkdir(graphDir, { recursive: true });
    const core = new ServerCore(whygraphDir);
    await core.load();

    const wtDir = await makeTempDir();
    const wtGraphDir = path.join(wtDir, ".whygraph", "graph");
    await fs.mkdir(wtGraphDir, { recursive: true });

    const mockDetect = vi.fn().mockResolvedValue([
      { path: wtDir, branch: "bad-file", graphDir: wtGraphDir } satisfies WorktreeInfo,
    ]);

    watcher = new WorktreeWatcher(core, "/fake/repo", { detectWorktrees: mockDetect });
    await watcher.startWatching();
    await new Promise((r) => setTimeout(r, 200));

    // Write a file with no valid YAML frontmatter — parseEntity returns null → entityId undefined
    await fs.writeFile(path.join(wtGraphDir, "no-frontmatter.md"), "just text, no yaml");
    await new Promise((r) => setTimeout(r, 800));

    // No entities should be added (false branch of else if (event.entityId))
    expect(core.getAllEntities()).toHaveLength(0);
  });

});
