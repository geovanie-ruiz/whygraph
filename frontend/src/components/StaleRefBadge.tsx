import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "urql";

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
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {staleRefs.map((ref) => (
          <button
            key={ref.entityId}
            type="button"
            data-testid={`stale-ref-${ref.entityId}`}
            onClick={() => handleOpenModal(ref)}
            title={ref.message}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              border: "1px solid #e74c3c",
              backgroundColor: "#fdf0ef",
              color: "#c0392b",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            <span aria-label="warning">&#9888;</span>
            {ref.entityId.slice(0, 8)}
          </button>
        ))}
      </div>

      {modalRef && (
        <div
          data-testid="stale-ref-modal"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "1.5rem",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 1rem" }}>Fix Stale Reference</h3>
            <p style={{ fontSize: "14px", color: "#666" }}>
              Entity: <code>{modalRef.entityId}</code>
            </p>
            <p style={{ fontSize: "14px", color: "#666" }}>
              Issue: {modalRef.message}
            </p>
            <div style={{ margin: "1rem 0" }}>
              <label htmlFor="new-ref-path" style={{ display: "block", marginBottom: "0.25rem", fontSize: "14px" }}>
                New file path:
              </label>
              <input
                id="new-ref-path"
                type="text"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="/src/path/to/file.ts"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  padding: "0.5rem 1rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                data-testid="stale-ref-submit"
                style={{
                  padding: "0.5rem 1rem",
                  border: "none",
                  borderRadius: "4px",
                  backgroundColor: "#2b8a8a",
                  color: "#fff",
                  cursor: "pointer",
                }}
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
