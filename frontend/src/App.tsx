import { useEffect, useState, useMemo } from "react";
import { Provider } from "urql";
import { urqlClient } from "./lib/graphql";
import {
  type Entity,
  type EntityChangeEvent,
  applyEvent,
  ENTITY_CHANGED_SUBSCRIPTION,
  EntityStoreContext,
} from "./lib/store";
import { wsClient } from "./lib/graphql";

function EntityDashboard() {
  const [entities, setEntities] = useState<Map<string, Entity>>(new Map());
  const [connected, setConnected] = useState(false);

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
        <div
          style={{
            marginTop: "2rem",
            padding: "2rem",
            border: "1px dashed #ccc",
            borderRadius: "8px",
            textAlign: "center",
            color: "#666",
          }}
        >
          Graph view coming soon
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
