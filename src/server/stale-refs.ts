import * as fs from "node:fs";
import * as path from "node:path";
import { isStructuralNode } from "../entity/types.js";
import type { Entity, SymbolRef } from "../entity/types.js";

export interface StaleRef {
  entityId: string;
  entityName: string;
  ref: SymbolRef;
}

export function detectStaleRefs(
  entities: Map<string, Entity>,
  basePath: string,
): StaleRef[] {
  const staleRefs: StaleRef[] = [];

  for (const [id, entity] of entities) {
    if (!isStructuralNode(entity)) continue;
    if (!entity.refs || entity.refs.length === 0) continue;

    for (const ref of entity.refs) {
      const absolutePath = path.resolve(basePath, ref.file);
      if (!fs.existsSync(absolutePath)) {
        staleRefs.push({
          entityId: id,
          entityName: entity.name,
          ref,
        });
      }
    }
  }

  return staleRefs;
}
