import * as fs from "node:fs/promises";
import * as path from "node:path";
import { FileWatcher, type WatcherEvent } from "./watcher.js";
import { ServerCore } from "./core.js";
import { detectWorktrees, type DetectDeps, type WorktreeInfo } from "./worktree.js";
import { parseEntity } from "../entity/parser.js";
import { computeETag } from "./etag.js";

export interface WorktreeWatcherDeps {
  detectWorktrees: (repoDir: string, deps?: DetectDeps) => Promise<WorktreeInfo[]>;
}

export class WorktreeWatcher {
  private readonly core: ServerCore;
  private readonly repoDir: string;
  private readonly watchers: Map<string, FileWatcher> = new Map();
  private readonly worktreeEntities: Set<string> = new Set();
  private readonly dirtyEntities: Set<string> = new Set();
  private readonly deps: WorktreeWatcherDeps;

  constructor(core: ServerCore, repoDir: string, deps?: WorktreeWatcherDeps) {
    this.core = core;
    this.repoDir = repoDir;
    this.deps = deps ?? { detectWorktrees };
  }

  async startWatching(): Promise<void> {
    const worktrees = await this.deps.detectWorktrees(this.repoDir);

    for (const wt of worktrees) {
      const watcher = new FileWatcher(wt.graphDir);
      this.watchers.set(wt.path, watcher);

      watcher.start((events: WatcherEvent[]) => {
        this.handleEvents(events, wt);
      });
    }
  }

  async stop(): Promise<void> {
    const stops = Array.from(this.watchers.values()).map((w) => w.stop());
    await Promise.all(stops);
    this.watchers.clear();
  }

  getWatchedWorktrees(): string[] {
    return Array.from(this.watchers.keys());
  }

  isWorktreeEntity(id: string): boolean {
    return this.worktreeEntities.has(id);
  }

  getDirtyIds(): string[] {
    return Array.from(this.dirtyEntities);
  }

  private handleEvents(events: WatcherEvent[], wt: WorktreeInfo): void {
    for (const event of events) {
      if (event.type === "deleted" && event.entityId) {
        this.worktreeEntities.delete(event.entityId);
        this.dirtyEntities.delete(event.entityId);
        this.core.removeEntity(event.entityId);
      /* v8 ignore next 1 */
      } else if (event.entityId) {
        this.worktreeEntities.add(event.entityId);
        // Read the file to get the full entity
        fs.readFile(event.filePath, "utf-8")
          .then((content) => {
            const entity = parseEntity(content);
            /* v8 ignore next 1 */
            if (entity) {
              // Track dirty state via ETag comparison with main entity
              const mainEntity = this.core.getEntity(entity.id);
              if (mainEntity && computeETag(entity) === computeETag(mainEntity)) {
                this.dirtyEntities.delete(entity.id);
              } else {
                this.dirtyEntities.add(entity.id);
              }

              // Mark entity as coming from a worktree
              const tagged = { ...entity, _worktree: wt.path };
              this.core.addOrUpdateEntity(entity.id, tagged);
            }
          })
          /* v8 ignore start */
          .catch(() => {
            // File may have been deleted between event and read
          });
          /* v8 ignore stop */
      }
    }
  }
}
