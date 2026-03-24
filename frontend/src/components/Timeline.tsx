import { useMemo, useCallback } from "react";
import type { Entity } from "../lib/store.js";

export interface TimelineProps {
  entities: Map<string, Entity>;
  filterTimestamp: number | null;
  onFilterChange: (timestamp: number | null) => void;
}

export function getTimestamps(entities: Map<string, Entity>): number[] {
  const seen = new Set<number>();
  for (const entity of entities.values()) {
    if (entity.created_at) {
      const ts = new Date(entity.created_at).getTime();
      if (!isNaN(ts)) seen.add(ts);
    }
  }
  return Array.from(seen).sort((a, b) => a - b);
}

export function filterEntitiesByTimestamp(
  entities: Map<string, Entity>,
  timestamp: number,
): Map<string, Entity> {
  const filtered = new Map<string, Entity>();
  for (const [id, entity] of entities) {
    const createdAt = new Date(entity.created_at).getTime();
    if (isNaN(createdAt) || createdAt > timestamp) continue;
    if (entity.removed_at) {
      const removedAt = new Date(entity.removed_at).getTime();
      if (!isNaN(removedAt) && removedAt <= timestamp) continue;
    }
    filtered.set(id, entity);
  }
  return filtered;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function Timeline({
  entities,
  filterTimestamp,
  onFilterChange,
}: TimelineProps) {
  const timestamps = useMemo(() => getTimestamps(entities), [entities]);

  const min = timestamps.length > 0 ? timestamps[0] : 0;
  const max = timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0;

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      onFilterChange(value);
    },
    [onFilterChange],
  );

  const handleLiveClick = useCallback(() => {
    onFilterChange(null);
  }, [onFilterChange]);

  if (timestamps.length < 2) {
    return null;
  }

  const currentValue = filterTimestamp ?? max;
  const isLive = filterTimestamp === null;

  return (
    <div
      data-testid="timeline"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "0.75rem 1rem",
        backgroundColor: "#f8f9fa",
        borderRadius: "8px",
        marginBottom: "1rem",
      }}
    >
      <label
        htmlFor="timeline-slider"
        style={{ fontWeight: "bold", whiteSpace: "nowrap" }}
      >
        Timeline:
      </label>
      <input
        id="timeline-slider"
        data-testid="timeline-slider"
        type="range"
        min={min}
        max={max}
        value={currentValue}
        onChange={handleSliderChange}
        style={{ flex: 1 }}
      />
      <span
        data-testid="timeline-label"
        style={{ fontSize: "12px", minWidth: "180px", textAlign: "center" }}
      >
        {isLive ? "Live" : formatTimestamp(currentValue)}
      </span>
      <button
        data-testid="timeline-live"
        onClick={handleLiveClick}
        disabled={isLive}
        style={{
          padding: "4px 12px",
          borderRadius: "4px",
          border: "1px solid #ccc",
          backgroundColor: isLive ? "#d4edda" : "#fff",
          cursor: isLive ? "default" : "pointer",
          fontWeight: isLive ? "bold" : "normal",
        }}
      >
        Live
      </button>
    </div>
  );
}
