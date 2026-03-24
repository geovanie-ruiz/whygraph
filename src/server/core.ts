import * as fs from "node:fs/promises";
import * as path from "node:path";
import graphology from "graphology";
import { parseEntity } from "../entity/parser.js";
import { buildGraph } from "../graph/projection.js";
import type { Entity } from "../entity/types.js";

type MultiDirectedGraph = graphology.MultiDirectedGraph;
const MultiDirectedGraph = graphology.MultiDirectedGraph;

export class ServerCore {
  private entityMap: Map<string, Entity>;
  private graph: MultiDirectedGraph;
  private readonly whygraphDir: string;

  constructor(whygraphDir: string) {
    this.whygraphDir = whygraphDir;
    this.entityMap = new Map();
    this.graph = new MultiDirectedGraph();
  }

  async load(): Promise<void> {
    const graphDir = path.join(this.whygraphDir, "graph");

    let entries: string[];
    try {
      entries = await fs.readdir(graphDir);
    } catch {
      // Directory doesn't exist — start with empty state
      return;
    }

    const mdFiles = entries.filter((f) => f.endsWith(".md"));

    for (const file of mdFiles) {
      const filePath = path.join(graphDir, file);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const entity = parseEntity(content);
        if (entity) {
          this.entityMap.set(entity.id, entity);
        } else {
          console.warn(`Skipping unparseable file: ${file}`);
        }
      } catch (err) {
        console.warn(`Error reading file ${file}:`, err);
      }
    }

    this.rebuildGraph();
  }

  getEntity(id: string): Entity | undefined {
    return this.entityMap.get(id);
  }

  getAllEntities(): Entity[] {
    return Array.from(this.entityMap.values());
  }

  getGraph(): MultiDirectedGraph {
    return this.graph;
  }

  getEntityMap(): Map<string, Entity> {
    return this.entityMap;
  }

  addOrUpdateEntity(id: string, entity: Entity): void {
    this.entityMap.set(id, entity);
    this.rebuildGraph();
  }

  removeEntity(id: string): void {
    this.entityMap.delete(id);
    this.rebuildGraph();
  }

  private rebuildGraph(): void {
    this.graph = buildGraph(this.getAllEntities());
  }
}
