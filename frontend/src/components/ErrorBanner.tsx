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

const CLI_RESOLVABLE_FIELDS = new Set(["tags", "parent", "date", "affects", "supersedes"]);

function isCliResolvable(errors: ValidationError[]): boolean {
  return errors.every((e) => CLI_RESOLVABLE_FIELDS.has(e.field));
}

export interface ErrorBannerProps {
  nodeErrors: Map<string, ValidationError[]>;
  generalErrors: EntityValidationError[];
}

export function ErrorBanner({ nodeErrors, generalErrors }: ErrorBannerProps) {
  const totalIssues = nodeErrors.size + generalErrors.length;
  if (totalIssues === 0) return null;

  let cliResolvable = 0;
  let agentNeeded = 0;

  for (const errors of nodeErrors.values()) {
    if (isCliResolvable(errors)) cliResolvable++;
    else agentNeeded++;
  }
  for (const entry of generalErrors) {
    if (isCliResolvable(entry.errors)) cliResolvable++;
    else agentNeeded++;
  }

  const parts: string[] = [];
  if (agentNeeded > 0) parts.push(`${agentNeeded} need an agent`);
  if (cliResolvable > 0) parts.push(`${cliResolvable} resolvable via whygraph issues`);

  return (
    <div className="error-banner">
      <span className="error-banner__icon">!</span>
      <span className="error-banner__text">
        {totalIssues} entity {totalIssues === 1 ? "issue" : "issues"}: {parts.join(", ")}
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
