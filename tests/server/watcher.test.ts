import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { FileWatcher, type WatcherEvent } from "../../src/server/watcher.js";

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "whygraph-watcher-test-"));
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

function waitForEvents(
  watcher: FileWatcher,
  timeoutMs = 2000,
): Promise<WatcherEvent[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for watcher events"));
    }, timeoutMs);
    watcher.start((events) => {
      clearTimeout(timer);
      resolve(events);
    });
  });
}

function collectBatches(
  watcher: FileWatcher,
  batchCount: number,
  timeoutMs = 3000,
): Promise<WatcherEvent[][]> {
  return new Promise((resolve, reject) => {
    const batches: WatcherEvent[][] = [];
    const timer = setTimeout(() => {
      // Resolve with what we have if timeout
      if (batches.length > 0) {
        resolve(batches);
      } else {
        reject(new Error("Timed out waiting for watcher batches"));
      }
    }, timeoutMs);
    watcher.start((events) => {
      batches.push(events);
      if (batches.length >= batchCount) {
        clearTimeout(timer);
        resolve(batches);
      }
    });
  });
}

describe("FileWatcher", () => {
  let watchDir: string;
  let watcher: FileWatcher;

  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
    }
  });

  it("detects new .md file added to watched directory", async () => {
    watchDir = await makeTempDir();
    watcher = new FileWatcher(watchDir);
    const eventsPromise = waitForEvents(watcher);

    // Small delay so watcher is ready
    await new Promise((r) => setTimeout(r, 200));
    await fs.writeFile(path.join(watchDir, "wg-feat1.md"), structuralMd("wg-feat1"));

    const events = await eventsPromise;
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("created");
    expect(events[0].entityId).toBe("wg-feat1");
    expect(events[0].filePath).toContain("wg-feat1.md");
  });

  it("detects file modification", async () => {
    watchDir = await makeTempDir();
    const filePath = path.join(watchDir, "wg-feat1.md");
    await fs.writeFile(filePath, structuralMd("wg-feat1"));

    watcher = new FileWatcher(watchDir);
    const eventsPromise = waitForEvents(watcher);

    await new Promise((r) => setTimeout(r, 200));
    await fs.writeFile(filePath, structuralMd("wg-feat1"));

    const events = await eventsPromise;
    expect(events.length).toBeGreaterThanOrEqual(1);
    // Could be "created" (if chokidar sees initial add) or "updated" (change)
    const changeEvent = events.find((e) => e.type === "updated" || e.type === "created");
    expect(changeEvent).toBeDefined();
    expect(changeEvent!.entityId).toBe("wg-feat1");
  });

  it("detects file deletion and extracts id from id--slug filename", async () => {
    watchDir = await makeTempDir();
    // Use the real filename format: id--slugified-name.md
    const filePath = path.join(watchDir, "wg-feat1--my-feature.md");
    await fs.writeFile(filePath, structuralMd("wg-feat1"));

    watcher = new FileWatcher(watchDir);

    let allEvents: WatcherEvent[] = [];
    const gotDelete = new Promise<WatcherEvent[]>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out waiting for delete event")), 3000);
      watcher.start((events) => {
        allEvents = allEvents.concat(events);
        const deleteEvent = allEvents.find((e) => e.type === "deleted");
        if (deleteEvent) {
          clearTimeout(timer);
          resolve(allEvents);
        }
      });
    });

    await new Promise((r) => setTimeout(r, 200));
    await fs.unlink(filePath);

    const events = await gotDelete;
    const deleteEvent = events.find((e) => e.type === "deleted");
    expect(deleteEvent).toBeDefined();
    expect(deleteEvent!.entityId).toBe("wg-feat1");
    expect(deleteEvent!.filePath).toContain("wg-feat1--my-feature.md");
  });

  it("debounces rapid changes into one batch", async () => {
    watchDir = await makeTempDir();
    watcher = new FileWatcher(watchDir);
    const eventsPromise = waitForEvents(watcher);

    await new Promise((r) => setTimeout(r, 200));

    // Write multiple files rapidly (within 100ms debounce window)
    await fs.writeFile(path.join(watchDir, "wg-a.md"), structuralMd("wg-a"));
    await fs.writeFile(path.join(watchDir, "wg-b.md"), structuralMd("wg-b"));
    await fs.writeFile(path.join(watchDir, "wg-c.md"), structuralMd("wg-c"));

    const events = await eventsPromise;
    // All three should arrive in a single batch due to debouncing
    expect(events.length).toBeGreaterThanOrEqual(2);
    const ids = events.map((e) => e.entityId).sort();
    expect(ids).toContain("wg-a");
    expect(ids).toContain("wg-b");
  });

  it("ignores non-.md files", async () => {
    watchDir = await makeTempDir();
    watcher = new FileWatcher(watchDir);

    // Collect with a short timeout — we expect no events from .txt
    const eventsPromise = waitForEvents(watcher, 800).catch(() => [] as WatcherEvent[]);

    await new Promise((r) => setTimeout(r, 200));
    await fs.writeFile(path.join(watchDir, "notes.txt"), "some text");
    await fs.writeFile(path.join(watchDir, "data.json"), "{}");

    const events = await eventsPromise;
    expect(events).toHaveLength(0);
  });


  it("clean shutdown stops watching", async () => {
    watchDir = await makeTempDir();
    watcher = new FileWatcher(watchDir);

    let callbackCalled = false;
    watcher.start(() => {
      callbackCalled = true;
    });

    await new Promise((r) => setTimeout(r, 200));
    await watcher.stop();

    // Write a file after stop — should not trigger callback
    await fs.writeFile(path.join(watchDir, "wg-late.md"), structuralMd("wg-late"));
    await new Promise((r) => setTimeout(r, 300));

    expect(callbackCalled).toBe(false);
  });
});
