import { useQuery } from "urql";
import "../styles/components/error-banner.css";

const VALIDATION_ERRORS_QUERY = `
  query {
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

interface ValidationError {
  field: string;
  message: string;
  severity: string;
}

interface EntityValidationError {
  entityId: string;
  errors: ValidationError[];
}

export interface ErrorBannerProps {
  generalErrors: EntityValidationError[];
}

export function ErrorBanner({ generalErrors }: ErrorBannerProps) {
  if (generalErrors.length === 0) return null;

  return (
    <div className="error-banner">
      <span className="error-banner__icon">!</span>
      <span className="error-banner__text">
        {generalErrors.length} entity {generalErrors.length === 1 ? "issue" : "issues"} detected
        {generalErrors.map((e) => (
          <span key={e.entityId} className="error-banner__detail">
            {e.entityId}: {e.errors.map((err) => err.message).join("; ")}
          </span>
        ))}
      </span>
    </div>
  );
}

export function useValidationErrors(entityIds: Set<string>): {
  nodeErrors: Map<string, ValidationError[]>;
  generalErrors: EntityValidationError[];
} {
  const [result] = useQuery<{ validationErrors: EntityValidationError[] }>({
    query: VALIDATION_ERRORS_QUERY,
  });

  const validationErrors = result.data?.validationErrors ?? [];
  const nodeErrors = new Map<string, ValidationError[]>();
  const generalErrors: EntityValidationError[] = [];

  for (const entry of validationErrors) {
    if (entityIds.has(entry.entityId)) {
      nodeErrors.set(entry.entityId, entry.errors);
    } else {
      generalErrors.push(entry);
    }
  }

  return { nodeErrors, generalErrors };
}
