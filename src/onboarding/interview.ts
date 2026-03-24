import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { generateId } from "../entity/id.js";
import { writeEntity } from "../entity/writer.js";
import { parseEntity } from "../entity/parser.js";
import { buildGraph } from "../graph/projection.js";
import { getGaps } from "../graph/gaps.js";
import type {
  Entity,
  StructuralNode,
  SymbolRef,
} from "../entity/types.js";

// ============================================================
// Types
// ============================================================

export interface InterviewFeatureInput {
  name: string;
  files?: string[];
}

export interface InterviewComponentInput {
  name: string;
  parent: string;
  files?: string[];
}

export interface InterviewOptions {
  features?: InterviewFeatureInput[];
  components?: InterviewComponentInput[];
}

export interface InterviewResult {
  created: Array<{ id: string; label: string; name: string }>;
  gaps: number;
}

// ============================================================
// Helpers
// ============================================================

function loadEntities(graphDir: string): Entity[] {
  if (!existsSync(graphDir)) return [];

  const files = readdirSync(graphDir).filter((f) => f.endsWith(".md"));
  const entities: Entity[] = [];

  for (const file of files) {
    const content = readFileSync(join(graphDir, file), "utf-8");
    const entity = parseEntity(content);
    if (entity !== null) {
      entities.push(entity);
    }
  }

  return entities;
}

function filesToRefs(files?: string[]): SymbolRef[] | undefined {
  if (!files || files.length === 0) return undefined;
  return files.map((file) => ({ file }));
}

// ============================================================
// Core Logic
// ============================================================

export async function runInterview(
  whygraphDir: string,
  options?: InterviewOptions,
): Promise<InterviewResult> {
  const graphDir = join(whygraphDir, "graph");

  // Load existing entities to understand current state
  const existingEntities = loadEntities(graphDir);
  const graph = buildGraph(existingEntities);
  const gaps = getGaps(graph);

  const now = new Date().toISOString();
  const created: Array<{ id: string; label: string; name: string }> = [];

  // Find an App node to use as parent for features
  const appNode = existingEntities.find(
    (e) => e.label === "App",
  );
  const appId = appNode?.id;

  // Create Feature nodes
  const featureIdMap = new Map<string, string>();

  if (options?.features) {
    for (const feature of options.features) {
      const id = generateId();
      featureIdMap.set(feature.name, id);

      const refs = filesToRefs(feature.files);
      const node: StructuralNode = {
        id,
        label: "Feature",
        name: feature.name,
        status: "active",
        created_at: now,
        updated_at: now,
        ...(appId !== undefined ? { parent: appId } : {}),
        ...(refs !== undefined ? { refs } : {}),
      };

      writeEntity(graphDir, node);
      created.push({ id, label: "Feature", name: feature.name });
    }
  }

  // Create Component nodes
  if (options?.components) {
    for (const component of options.components) {
      const id = generateId();
      const parentId = featureIdMap.get(component.parent);

      if (parentId === undefined) {
        continue;
      }

      const refs = filesToRefs(component.files);
      const node: StructuralNode = {
        id,
        label: "Component",
        name: component.name,
        status: "active",
        parent: parentId,
        created_at: now,
        updated_at: now,
        ...(refs !== undefined ? { refs } : {}),
      };

      writeEntity(graphDir, node);
      created.push({ id, label: "Component", name: component.name });
    }
  }

  return {
    created,
    gaps: gaps.length,
  };
}
