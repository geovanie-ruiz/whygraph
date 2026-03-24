import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "urql";
import "../styles/components/stale-ref-badge.css";

const VALIDATION_ERRORS_QUERY = `
  query ValidationErrors {
    validationErrors {
      entityId
      errors {
        field
        message
        severity
      }
    }
  }
`;

const UPDATE_ENTITY_MUTATION = `
  mutation UpdateEntity($id: ID!, $refs: [SymbolRefInput!]) {
    updateEntity(id: $id, refs: $refs) {
      __typename
      ... on StructuralNode {
        id
        refs {
          file
          symbol
        }
      }
    }
  }
`;

interface ValidationErrorEntry {
  field: string;
  message: string;
  severity: string;
}

interface EntityValidationError {
  entityId: string;
  errors: ValidationErrorEntry[];
}

export interface StaleRef {
  entityId: string;
  field: string;
  message: string;
}

export interface StaleRefBadgeProps {
  onStaleRefIdsChange: (staleIds: Set<string>) => void;
}

function extractStaleRefs(
  validationErrors: EntityValidationError[],
): StaleRef[] {
  const staleRefs: StaleRef[] = [];
  for (const entry of validationErrors) {
    for (const error of entry.errors) {
      if (error.field === "refs") {
        staleRefs.push({
          entityId: entry.entityId,
          field: error.field,
          message: error.message,
        });
      }
    }
  }
  return staleRefs;
}

export function StaleRefBadge({ onStaleRefIdsChange }: StaleRefBadgeProps) {
  const [result] = useQuery<{
    validationErrors: EntityValidationError[];
  }>({
    query: VALIDATION_ERRORS_QUERY,
  });

  const [, updateEntity] = useMutation(UPDATE_ENTITY_MUTATION);

  const [modalRef, setModalRef] = useState<StaleRef | null>(null);
  const [newPath, setNewPath] = useState("");

  const validationErrors = result.data?.validationErrors ?? [];
  const staleRefs = extractStaleRefs(validationErrors);

  useEffect(() => {
    onStaleRefIdsChange(new Set(staleRefs.map((r) => r.entityId)));
  }, [staleRefs, onStaleRefIdsChange]);

  const handleOpenModal = useCallback((ref: StaleRef) => {
    setModalRef(ref);
    setNewPath("");
  }, []);

  const handleClose = useCallback(() => {
    setModalRef(null);
    setNewPath("");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!modalRef || !newPath.trim()) return;
    await updateEntity({
      id: modalRef.entityId,
      refs: [{ file: newPath.trim() }],
    });
    handleClose();
  }, [modalRef, newPath, updateEntity, handleClose]);

  if (staleRefs.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="stale-ref-list">
        {staleRefs.map((ref) => (
          <button
            key={ref.entityId}
            type="button"
            className="stale-ref-btn"
            data-testid={`stale-ref-${ref.entityId}`}
            onClick={() => handleOpenModal(ref)}
            title={ref.message}
          >
            <span aria-label="warning">&#9888;</span>
            {ref.entityId.slice(0, 8)}
          </button>
        ))}
      </div>

      {modalRef && (
        <div className="stale-ref-overlay" data-testid="stale-ref-modal">
          <div className="stale-ref-modal">
            <h3>Fix Stale Reference</h3>
            <p>
              Entity: <code>{modalRef.entityId}</code>
            </p>
            <p>
              Issue: {modalRef.message}
            </p>
            <div className="stale-ref-modal__field">
              <label htmlFor="new-ref-path">
                New file path:
              </label>
              <input
                id="new-ref-path"
                type="text"
                className="stale-ref-modal__input"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="/src/path/to/file.ts"
              />
            </div>
            <div className="stale-ref-modal__actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={handleClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmit}
                data-testid="stale-ref-submit"
              >
                Update Ref
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
