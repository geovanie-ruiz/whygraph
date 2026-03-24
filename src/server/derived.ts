import type { Entity } from "../entity/types.js";
import { validateEntity } from "../entity/validate.js";
import type { ValidationError } from "../entity/validate.js";
import { detectSupersedeCandidates } from "../graph/supersede.js";
import type { SupersedeCandidate } from "../graph/supersede.js";

export interface DerivedState {
  validationErrors: Map<string, ValidationError[]>;
  supersedeCandidates: SupersedeCandidate[];
}

export function computeDerivedState(
  entities: Map<string, Entity>,
): DerivedState {
  const validationErrors = new Map<string, ValidationError[]>();

  for (const [id, entity] of entities) {
    const result = validateEntity(entity);
    if (result.errors.length > 0) {
      validationErrors.set(id, result.errors);
    }
  }

  const supersedeCandidates = detectSupersedeCandidates(entities);

  return { validationErrors, supersedeCandidates };
}
