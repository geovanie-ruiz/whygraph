import type {
  Entity,
  StructuralNodeEntity,
  DecisionNodeEntity,
} from "../lib/store.js";

interface ValidationError {
  field: string;
  message: string;
  severity: string;
}

export interface DetailPanelProps {
  entity: Entity | null;
  entities: Map<string, Entity>;
  onClose: () => void;
  errors?: ValidationError[];
}

function isStructural(e: Entity): e is StructuralNodeEntity {
  return "name" in e;
}

function isDecision(e: Entity): e is DecisionNodeEntity {
  return "title" in e;
}

function resolveEntityName(
  id: string,
  entities: Map<string, Entity>,
): string {
  const entity = entities.get(id);
  if (!entity) return id;
  if (isDecision(entity)) return entity.title;
  return (entity as StructuralNodeEntity).name;
}

function DecisionDetail({
  entity,
  entities,
}: {
  entity: DecisionNodeEntity;
  entities: Map<string, Entity>;
}) {
  return (
    <div data-testid="decision-detail">
      <h2>{entity.title}</h2>
      <div className="detail-field">
        <strong>Status:</strong> {entity.status}
      </div>
      <div className="detail-field">
        <strong>Date:</strong> {entity.date}
      </div>
      {entity.tags.length > 0 && (
        <div className="detail-field">
          <strong>Tags:</strong>{" "}
          {entity.tags.map((tag) => (
            <span key={tag} className="detail-tag">
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="detail-field">
        <strong>Context:</strong>
        <p>{entity.context}</p>
      </div>
      <div className="detail-field">
        <strong>Decision:</strong>
        <p>{entity.decision}</p>
      </div>
      <div className="detail-field">
        <strong>Tradeoffs:</strong>
        <p>{entity.tradeoffs}</p>
      </div>
      <div className="detail-field">
        <strong>Alternatives:</strong>
        <p>{entity.alternatives}</p>
      </div>
      {entity.affects.length > 0 && (
        <div className="detail-field">
          <strong>Affects:</strong>
          <ul>
            {entity.affects.map((id) => (
              <li key={id}>{resolveEntityName(id, entities)}</li>
            ))}
          </ul>
        </div>
      )}
      {entity.supersedes && (
        <div className="detail-field">
          <strong>Supersedes:</strong>{" "}
          {resolveEntityName(entity.supersedes, entities)}
        </div>
      )}
    </div>
  );
}

function StructuralDetail({ entity }: { entity: StructuralNodeEntity }) {
  return (
    <div data-testid="structural-detail">
      <h2>{entity.name}</h2>
      <div className="detail-field">
        <strong>Label:</strong> {entity.label}
      </div>
      <div className="detail-field">
        <strong>Status:</strong> {entity.status}
      </div>
      {entity.parent && (
        <div className="detail-field">
          <strong>Parent:</strong> {entity.parent}
        </div>
      )}
      {entity.description && (
        <div className="detail-field">
          <strong>Description:</strong>
          <p>{entity.description}</p>
        </div>
      )}
      {entity.refs && entity.refs.length > 0 && (
        <div className="detail-field">
          <strong>Refs:</strong>
          <ul>
            {entity.refs.map((ref, i) => (
              <li key={i}>
                {ref.file}
                {ref.symbol ? ` (${ref.symbol})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ErrorDetail({ errors }: { errors: ValidationError[] }) {
  return (
    <div className="detail-errors">
      <div className="detail-errors__status">Status: error</div>
      <ul className="detail-errors__list">
        {errors.map((err, i) => (
          <li key={i} className="detail-errors__item">
            <strong>{err.field}:</strong> {err.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DetailPanel({ entity, entities, onClose, errors }: DetailPanelProps) {
  const isOpen = entity !== null;

  return (
    <>
      {isOpen && (
        <div className="detail-panel__backdrop" onClick={onClose} />
      )}
      <div
        data-testid="detail-panel"
        className="detail-panel"
        data-open={isOpen}
      >
      {entity && (
        <>
          <button
            data-testid="detail-close"
            onClick={onClose}
            className="detail-panel__close"
            aria-label="Close"
          >
            ×
          </button>
          {errors && errors.length > 0 && <ErrorDetail errors={errors} />}
          {isDecision(entity) ? (
            <DecisionDetail entity={entity} entities={entities} />
          ) : isStructural(entity) ? (
            <StructuralDetail entity={entity} />
          ) : null}
        </>
      )}
    </div>
    </>
  );
}
