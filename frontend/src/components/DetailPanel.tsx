import type {
  Entity,
  StructuralNodeEntity,
  DecisionNodeEntity,
} from "../lib/store.js";

export interface DetailPanelProps {
  entity: Entity | null;
  entities: Map<string, Entity>;
  onClose: () => void;
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
            <span
              key={tag}
              style={{
                display: "inline-block",
                padding: "2px 8px",
                margin: "2px",
                borderRadius: "12px",
                backgroundColor: "#e8e8e8",
                fontSize: "12px",
              }}
            >
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

export function DetailPanel({ entity, entities, onClose }: DetailPanelProps) {
  const isOpen = entity !== null;

  return (
    <div
      data-testid="detail-panel"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: "400px",
        height: "100vh",
        backgroundColor: "#fff",
        boxShadow: "-2px 0 8px rgba(0,0,0,0.15)",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s ease-in-out",
        overflowY: "auto",
        padding: "1.5rem",
        zIndex: 1000,
      }}
    >
      {entity && (
        <>
          <button
            data-testid="detail-close"
            onClick={onClose}
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
            }}
            aria-label="Close"
          >
            ×
          </button>
          {isDecision(entity) ? (
            <DecisionDetail entity={entity} entities={entities} />
          ) : isStructural(entity) ? (
            <StructuralDetail entity={entity} />
          ) : null}
        </>
      )}
    </div>
  );
}
