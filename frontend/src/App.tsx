import { useEffect, useState, useMemo, useCallback } from "react";
import { Provider } from "urql";
import { urqlClient } from "./lib/graphql.js";
import {
  type Entity,
  type EntityChangeEvent,
  applyEvent,
  ENTITY_CHANGED_SUBSCRIPTION,
  EntityStoreContext,
} from "./lib/store.js";
import { wsClient } from "./lib/graphql.js";
import { GraphView } from "./components/GraphView.js";
import { DetailPanel } from "./components/DetailPanel.js";
import { Timeline, filterEntitiesByTimestamp } from "./components/Timeline.js";

function EntityDashboard() {
  const [entities, setEntities] = useState<Map<string, Entity>>(new Map());
  const [connected, setConnected] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [filterTimestamp, setFilterTimestamp] = useState<number | null>(null);

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
    setSelectedEntityId(entityId);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedEntityId(null);
  }, []);

  const handleFilterChange = useCallback((timestamp: number | null) => {
    setFilterTimestamp(timestamp);
  }, []);

  const storeValue = useMemo(
    () => ({ entities, connected }),
    [entities, connected],
  );

  const displayEntities = useMemo(() => {
    if (filterTimestamp === null) return entities;
    return filterEntitiesByTimestamp(entities, filterTimestamp);
  }, [entities, filterTimestamp]);

  const selectedEntity = selectedEntityId
    ? entities.get(selectedEntityId) ?? null
    : null;

  const nodeCount = Array.from(displayEntities.values()).filter(
    (e) => e.label !== "Decision",
  ).length;
  const decisionCount = Array.from(displayEntities.values()).filter(
    (e) => e.label === "Decision",
  ).length;

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
            <strong>Entities:</strong> {displayEntities.size}
          </p>
          <p>
            <strong>Nodes:</strong> {nodeCount}
          </p>
          <p>
            <strong>Decisions:</strong> {decisionCount}
          </p>
        </div>
        <div style={{ marginTop: "2rem" }}>
          <Timeline
            entities={entities}
            filterTimestamp={filterTimestamp}
            onFilterChange={handleFilterChange}
          />
          <GraphView entities={displayEntities} onSelect={handleSelect} />
        </div>
      </div>
      <DetailPanel
        entity={selectedEntity}
        entities={entities}
        onClose={handleCloseDetail}
      />
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
