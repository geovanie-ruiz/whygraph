import * as fs from "node:fs/promises";
import * as path from "node:path";
import { watch, type FSWatcher } from "chokidar";
import { parseEntity } from "../entity/parser.js";
import { parseFilename } from "../entity/id.js";

export interface WatcherEvent {
  type: "created" | "updated" | "deleted";
  filePath: string;
  entityId?: string;
}

export type WatcherCallback = (events: WatcherEvent[]) => void;

export class FileWatcher {
  private readonly dirPath: string;
  private watcher: FSWatcher | null = null;
  private pendingEvents: WatcherEvent[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private callback: WatcherCallback | null = null;
  private knownFiles: Set<string> = new Set();

  constructor(dirPath: string) {
    this.dirPath = dirPath;
  }

  start(callback: WatcherCallback): void {
    this.callback = callback;

    this.watcher = watch(this.dirPath, {
      ignoreInitial: true,
      awaitWriteFinish: false,
    });

    this.watcher.on("add", (filePath: string) => {
      if (!filePath.endsWith(".md")) return;
      this.knownFiles.add(filePath);
      this.handleFileChange(filePath, "created");
    });

    this.watcher.on("change", (filePath: string) => {
      /* v8 ignore next 1 */
      if (!filePath.endsWith(".md")) return;
      this.handleFileChange(filePath, "updated");
    });

    this.watcher.on("unlink", (filePath: string) => {
      /* v8 ignore next 1 */
      if (!filePath.endsWith(".md")) return;
      this.knownFiles.delete(filePath);
      /* v8 ignore next 1 */
      const entityId = parseFilename(filePath) ?? undefined;
      this.enqueue({
        type: "deleted",
        filePath,
        entityId,
      });
    });
  }

  async stop(): Promise<void> {
    /* v8 ignore next 4 */
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.pendingEvents = [];
    this.callback = null;
    this.knownFiles.clear();
  }

  private handleFileChange(filePath: string, type: "created" | "updated"): void {
    fs.readFile(filePath, "utf-8")
      .then((content) => {
        const entity = parseEntity(content);
        this.enqueue({
          type,
          filePath,
          entityId: entity?.id,
        });
      })
      /* v8 ignore start */
      .catch(() => {
        // File may have been deleted between event and read — ignore
      });
      /* v8 ignore stop */
  }

  private enqueue(event: WatcherEvent): void {
    this.pendingEvents.push(event);
    this.scheduleBatch();
  }

  private scheduleBatch(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.flush();
    }, 100);
  }

  private flush(): void {
    /* v8 ignore next 1 */
    if (this.pendingEvents.length === 0 || !this.callback) return;
    const events = this.pendingEvents;
    this.pendingEvents = [];
    this.debounceTimer = null;
    this.callback(events);
  }
}
