import { renderEntity } from "../entity/writer.js";
import type { Entity } from "../entity/types.js";

/**
 * FNV-1a hash of a string, returned as hex.
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5; // FNV offset basis (32-bit)
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime, keep as uint32
  }
  return hash.toString(16);
}

/**
 * Compute an ETag for an entity by hashing its rendered markdown output.
 */
export function computeETag(entity: Entity): string {
  const rendered = renderEntity(entity);
  return fnv1a(rendered);
}

/**
 * Compare two entities by ETag to determine if the worktree copy has diverged.
 */
export function isDirty(worktreeEntity: Entity, mainEntity: Entity): boolean {
  return computeETag(worktreeEntity) !== computeETag(mainEntity);
}
