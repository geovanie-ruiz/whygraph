import { useState, useMemo } from "react";
import type { Entity, StructuralNodeEntity, DecisionNodeEntity } from "../lib/store.js";
import "../styles/components/tree-nav.css";

export interface TreeNavProps {
  entities: Map<string, Entity>;
  selectedEntityId: string | null;
  onNodeClick: (id: string) => void;
  errorIds?: Set<string>;
  staleRefIds?: Set<string>;
}

function isDecision(e: Entity): e is DecisionNodeEntity {
  return "title" in e;
}

interface TreeData {
  app: StructuralNodeEntity | null;
  features: StructuralNodeEntity[];
  componentsByFeature: Map<string, StructuralNodeEntity[]>;
  decisionsByNode: Map<string, DecisionNodeEntity[]>;
  orphanedDecisions: DecisionNodeEntity[];
}

export function buildTreeData(entities: Map<string, Entity>): TreeData {
  const features: StructuralNodeEntity[] = [];
  const components: StructuralNodeEntity[] = [];
  const decisions: DecisionNodeEntity[] = [];
  let app: StructuralNodeEntity | null = null;

  for (const e of entities.values()) {
    if (e.label === "App") app = e as StructuralNodeEntity;
    else if (e.label === "Feature") features.push(e as StructuralNodeEntity);
    else if (e.label === "Component") components.push(e as StructuralNodeEntity);
    else if (isDecision(e)) decisions.push(e);
  }

  features.sort((a, b) => a.created_at.localeCompare(b.created_at));
  components.sort((a, b) => a.created_at.localeCompare(b.created_at));

  const componentsByFeature = new Map<string, StructuralNodeEntity[]>();
  for (const c of components) {
    const pid = c.parent ?? "";
    if (!componentsByFeature.has(pid)) componentsByFeature.set(pid, []);
    componentsByFeature.get(pid)!.push(c);
  }

  // Each decision attaches to the first affects[] entry visible in this entity set.
  // Decisions with no visible affected node go to orphanedDecisions.
  const decisionsByNode = new Map<string, DecisionNodeEntity[]>();
  const orphanedDecisions: DecisionNodeEntity[] = [];

  for (const d of decisions) {
    const primaryId = d.affects.find((id) => entities.has(id));
    if (primaryId) {
      if (!decisionsByNode.has(primaryId)) decisionsByNode.set(primaryId, []);
      decisionsByNode.get(primaryId)!.push(d);
    } else {
      orphanedDecisions.push(d);
    }
  }

  return { app, features, componentsByFeature, decisionsByNode, orphanedDecisions };
}

export function TreeNav({
  entities,
  selectedEntityId,
  onNodeClick,
  errorIds,
  staleRefIds,
}: TreeNavProps) {
  const [open, setOpen] = useState(true);
  // Track explicitly expanded features; absent = collapsed (new features default closed)
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildTreeData(entities), [entities]);

  const toggleFeature = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderDecisions = (nodeId: string) =>
    (tree.decisionsByNode.get(nodeId) ?? []).map((d) => (
      <button
        key={d.id}
        className={`tree-node tree-node--decision${selectedEntityId === d.id ? " tree-node--selected" : ""}`}
        onClick={() => onNodeClick(d.id)}
        title={d.title}
      >
        <span className="tree-node__icon tree-node__icon--decision">◆</span>
        <span className="tree-node__name">{d.title}</span>
        {errorIds?.has(d.id) && <span className="tree-node__badge tree-node__badge--error">!</span>}
      </button>
    ));

  const renderBadges = (id: string) => (
    <>
      {errorIds?.has(id) && <span className="tree-node__badge tree-node__badge--error">!</span>}
      {staleRefIds?.has(id) && <span className="tree-node__badge tree-node__badge--stale">~</span>}
    </>
  );

  return (
    <div className={`tree-nav${open ? " tree-nav--open" : ""}`}>
      <button
        className="tree-nav__toggle"
        onClick={() => setOpen((p) => !p)}
        title={open ? "Collapse navigator" : "Expand navigator"}
        aria-label={open ? "Collapse navigator" : "Expand navigator"}
      >
        {open ? "‹" : "›"}
      </button>

      {open && (
        <div className="tree-nav__body">
          <div className="tree-nav__heading">Navigator</div>
          <div className="tree-nav__scroll">

            {/* App node */}
            {tree.app && (
              <div className="tree-section">
                <button
                  className={`tree-node tree-node--app${selectedEntityId === tree.app.id ? " tree-node--selected" : ""}`}
                  onClick={() => onNodeClick(tree.app!.id)}
                  title={tree.app.name}
                >
                  <span className="tree-node__icon tree-node__icon--app" />
                  <span className="tree-node__name">{tree.app.name}</span>
                  {renderBadges(tree.app.id)}
                </button>
                {renderDecisions(tree.app.id)}
              </div>
            )}

            {/* Features */}
            {tree.features.map((feature) => {
              const isExpanded = expanded.has(feature.id);
              const children = tree.componentsByFeature.get(feature.id) ?? [];
              const hasChildren = children.length > 0 || (tree.decisionsByNode.get(feature.id)?.length ?? 0) > 0;

              return (
                <div key={feature.id} className="tree-accordion">
                  <div className="tree-accordion__row">
                    <button
                      className="tree-accordion__arrow"
                      onClick={() => toggleFeature(feature.id)}
                      aria-expanded={isExpanded}
                      style={{ visibility: hasChildren ? "visible" : "hidden" }}
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                    <button
                      className={`tree-node tree-node--feature${selectedEntityId === feature.id ? " tree-node--selected" : ""}`}
                      onClick={() => onNodeClick(feature.id)}
                      title={feature.name}
                    >
                      <span className="tree-node__icon tree-node__icon--feature" />
                      <span className="tree-node__name">{feature.name}</span>
                      {renderBadges(feature.id)}
                    </button>
                  </div>

                  {isExpanded && hasChildren && (
                    <div className="tree-accordion__children">
                      {renderDecisions(feature.id)}
                      {children.map((c) => (
                        <div key={c.id}>
                          <button
                            className={`tree-node tree-node--component${selectedEntityId === c.id ? " tree-node--selected" : ""}`}
                            onClick={() => onNodeClick(c.id)}
                            title={c.name}
                          >
                            <span className="tree-node__icon tree-node__icon--component" />
                            <span className="tree-node__name">{c.name}</span>
                            {renderBadges(c.id)}
                          </button>
                          {renderDecisions(c.id)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Decisions with no visible affected node */}
            {tree.orphanedDecisions.length > 0 && (
              <div className="tree-section tree-section--orphans">
                <div className="tree-section__label">Decisions</div>
                {tree.orphanedDecisions.map((d) => (
                  <button
                    key={d.id}
                    className={`tree-node tree-node--decision${selectedEntityId === d.id ? " tree-node--selected" : ""}`}
                    onClick={() => onNodeClick(d.id)}
                    title={d.title}
                  >
                    <span className="tree-node__icon tree-node__icon--decision">◆</span>
                    <span className="tree-node__name">{d.title}</span>
                    {errorIds?.has(d.id) && <span className="tree-node__badge tree-node__badge--error">!</span>}
                  </button>
                ))}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
