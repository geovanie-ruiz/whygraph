import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
import { ThemeProvider } from "./lib/theme.js";
import { GraphView, type GraphViewHandle } from "./components/GraphView.js";
import { DetailPanel } from "./components/DetailPanel.js";
import { TreeNav } from "./components/TreeNav.js";
import { GapHighlight } from "./components/GapHighlight.js";
import type { DecisionTag } from "./components/TagFilter.js";
import { StaleRefBadge } from "./components/StaleRefBadge.js";
import { Header } from "./components/Header.js";
import { Footer } from "./components/Footer.js";
import { MenuDropdown } from "./components/MenuDropdown.js";
import { ErrorBanner, useValidationErrors } from "./components/ErrorBanner.js";
import { Timeline, filterEntitiesByTimestamp } from "./components/Timeline.js";
import "./styles/app-shell.css";

function EntityDashboard() {
  const [entities, setEntities] = useState<Map<string, Entity>>(new Map());
  const [connected, setConnected] = useState(false);
  const [gapIds, setGapIds] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<DecisionTag>>(new Set());
  const [staleRefIds, setStaleRefIds] = useState<Set<string>>(new Set());
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterTimestamp, setFilterTimestamp] = useState<number | null>(null);
  const graphRef = useRef<GraphViewHandle>(null);

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

  const handleTreeNodeClick = useCallback((entityId: string) => {
    setSelectedEntityId(entityId);
    graphRef.current?.zoomToNode(entityId);
  }, []);

  const handleMenuToggle = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const selectedEntity = selectedEntityId ? entities.get(selectedEntityId) ?? null : null;

  const entityIdSet = useMemo(() => new Set(entities.keys()), [entities]);
  const { nodeErrors, generalErrors } = useValidationErrors(entityIdSet);
  const selectedEntityErrors = selectedEntityId ? nodeErrors.get(selectedEntityId) : undefined;

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

  // Filter entities by timeline timestamp
  const timestampFilteredEntities = useMemo(() => {
    if (filterTimestamp === null) return entities;
    return filterEntitiesByTimestamp(entities, filterTimestamp);
  }, [entities, filterTimestamp]);

  // Filter entities by selected tags (OR logic)
  const filteredEntities = useMemo(() => {
    if (selectedTags.size === 0) return timestampFilteredEntities;
    const filtered = new Map<string, Entity>();
    const connectedNodeIds = new Set<string>();

    // First pass: find matching decisions and their connected nodes
    for (const [id, entity] of timestampFilteredEntities) {
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
    const addWithParents = (nodeId: string) => {
      const entity = timestampFilteredEntities.get(nodeId);
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
  }, [timestampFilteredEntities, selectedTags]);

  return (
    <EntityStoreContext.Provider value={storeValue}>
      <div className="app-shell">
        <Header connected={connected} menuOpen={menuOpen} onMenuToggle={handleMenuToggle}>
          <MenuDropdown
            open={menuOpen}
            onClose={handleMenuClose}
            onTagsChange={setSelectedTags}
            onGapIdsChange={setGapIds}
            onStaleRefIdsChange={setStaleRefIds}
          />
        </Header>
        <div className="app-graph-area">
          <TreeNav
            entities={filteredEntities}
            selectedEntityId={selectedEntityId}
            onNodeClick={handleTreeNodeClick}
            errorIds={new Set(nodeErrors.keys())}
            staleRefIds={staleRefIds}
          />
          <div className="graph-area-main">
            <div className="graph-viewport">
              <ErrorBanner nodeErrors={nodeErrors} generalErrors={generalErrors} />
              <GraphView
                ref={graphRef}
                entities={filteredEntities}
                onSelect={handleSelect}
                onDeselect={() => setSelectedEntityId(null)}
                selectedEntityId={selectedEntityId}
                onFitAll={() => setSelectedEntityId(null)}
                highlightedIds={gapIds}
                staleRefIds={staleRefIds}
                errorIds={new Set(nodeErrors.keys())}
              />
            </div>
            <DetailPanel
              entity={selectedEntity}
              entities={entities}
              onClose={() => setSelectedEntityId(null)}
              errors={selectedEntityErrors}
            />
          </div>
        </div>
        <Timeline
          entities={entities}
          filterTimestamp={filterTimestamp}
          onFilterChange={setFilterTimestamp}
        />
        <Footer
          entityCount={entities.size}
          nodeCount={nodeCount}
          decisionCount={decisionCount}
        />
      </div>
      {/* Always mounted so GraphQL queries run on load, not on first menu open */}
      <div style={{ display: "none" }}>
        <GapHighlight onGapIdsChange={setGapIds} />
        <StaleRefBadge onStaleRefIdsChange={setStaleRefIds} />
      </div>
    </EntityStoreContext.Provider>
  );
}

export function App() {
  return (
    <Provider value={urqlClient}>
      <ThemeProvider>
        <EntityDashboard />
      </ThemeProvider>
    </Provider>
  );
}
