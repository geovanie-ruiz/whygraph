import { useEffect, useState, useMemo, useCallback } from "react";
import { Provider } from "urql";
import { urqlClient } from "./lib/graphql.js";
import {
  type Entity,
  type DecisionNodeEntity,
  type EntityChangeEvent,
  applyEvent,
  ENTITY_CHANGED_SUBSCRIPTION,
  EntityStoreContext,
} from "./lib/store.js";
import { wsClient } from "./lib/graphql.js";
import { GraphView } from "./components/GraphView.js";
import { DetailPanel } from "./components/DetailPanel.js";
import { GapHighlight } from "./components/GapHighlight.js";
import { TagFilter } from "./components/TagFilter.js";
import type { DecisionTag } from "./components/TagFilter.js";
import { StaleRefBadge } from "./components/StaleRefBadge.js";

function EntityDashboard() {
  const [entities, setEntities] = useState<Map<string, Entity>>(new Map());
  const [connected, setConnected] = useState(false);
  const [gapIds, setGapIds] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<DecisionTag>>(new Set());
  const [staleRefIds, setStaleRefIds] = useState<Set<string>>(new Set());
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = wsClient.subscribe<{
      entityChanged: EntityChangeEvent;
    }>(
      {
        query: ENTITY_CHANGED_SUBSCRIPTION,
        variables: { includeInitial: true },
      },
      {
        next(value) {
          if (value.data?.entityChanged) {
            setConnected(true);
            setEntities((prev) => applyEvent(prev, value.data!.entityChanged));
          }
        },
        error(err) {
          console.error("Subscription error:", err);
          setConnected(false);
        },
        complete() {
          setConnected(false);
        },
      },
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSelect = useCallback((entityId: string) => {
    setSelectedEntityId((prev) => (prev === entityId ? null : entityId));
  }, []);

  const selectedEntity = selectedEntityId ? entities.get(selectedEntityId) ?? null : null;

  const storeValue = useMemo(
    () => ({ entities, connected }),
    [entities, connected],
  );

  const nodeCount = Array.from(entities.values()).filter(
    (e) => e.label !== "Decision",
  ).length;
  const decisionCount = Array.from(entities.values()).filter(
    (e) => e.label === "Decision",
  ).length;

  // Filter entities by selected tags (OR logic)
  const filteredEntities = useMemo(() => {
    if (selectedTags.size === 0) return entities;
    const filtered = new Map<string, Entity>();
    const connectedNodeIds = new Set<string>();

    // First pass: find matching decisions and their connected nodes
    for (const [id, entity] of entities) {
      if ("tags" in entity) {
        const decision = entity as DecisionNodeEntity;
        const hasMatchingTag = decision.tags.some((t) =>
          selectedTags.has(t as DecisionTag),
        );
        if (hasMatchingTag) {
          filtered.set(id, entity);
          for (const affectedId of decision.affects) {
            connectedNodeIds.add(affectedId);
          }
          if (decision.supersedes) {
            connectedNodeIds.add(decision.supersedes);
          }
        }
      }
    }

    // Second pass: include structural nodes connected to matching decisions
    // Also include their parent chain
    const addWithParents = (nodeId: string) => {
      const entity = entities.get(nodeId);
      if (!entity || filtered.has(nodeId)) return;
      filtered.set(nodeId, entity);
      if ("parent" in entity && entity.parent) {
        addWithParents(entity.parent as string);
      }
    };

    for (const nodeId of connectedNodeIds) {
      addWithParents(nodeId);
    }

    return filtered;
  }, [entities, selectedTags]);

  return (
    <EntityStoreContext.Provider value={storeValue}>
      <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <h1>whygraph</h1>
        <div
          style={{
            display: "inline-block",
            padding: "0.25rem 0.5rem",
            borderRadius: "4px",
            backgroundColor: connected ? "#d4edda" : "#f8d7da",
            color: connected ? "#155724" : "#721c24",
            marginBottom: "1rem",
          }}
        >
          {connected ? "Connected" : "Connecting..."}
        </div>
        <div style={{ marginTop: "1rem" }}>
          <p>
            <strong>Entities:</strong> {entities.size}
          </p>
          <p>
            <strong>Nodes:</strong> {nodeCount}
          </p>
          <p>
            <strong>Decisions:</strong> {decisionCount}
          </p>
        </div>
        <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
          <GapHighlight onGapIdsChange={setGapIds} />
          <StaleRefBadge onStaleRefIdsChange={setStaleRefIds} />
        </div>
        <div style={{ marginTop: "0.75rem" }}>
          <TagFilter onTagsChange={setSelectedTags} />
        </div>
        <div style={{ marginTop: "2rem", position: "relative" }}>
          <GraphView
            entities={filteredEntities}
            onSelect={handleSelect}
            highlightedIds={gapIds}
            staleRefIds={staleRefIds}
          />
          <DetailPanel
            entity={selectedEntity}
            entities={entities}
            onClose={() => setSelectedEntityId(null)}
          />
        </div>
      </div>
    </EntityStoreContext.Provider>
  );
}

export function App() {
  return (
    <Provider value={urqlClient}>
      <EntityDashboard />
    </Provider>
  );
}
