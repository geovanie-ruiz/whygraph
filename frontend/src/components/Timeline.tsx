import { useMemo, useCallback } from "react";
import type { Entity } from "../lib/store.js";
import "../styles/components/timeline.css";

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
    <div className="timeline" data-testid="timeline">
      <label htmlFor="timeline-slider" className="timeline__label">
        Timeline:
      </label>
      <input
        id="timeline-slider"
        className="timeline__slider"
        data-testid="timeline-slider"
        type="range"
        min={min}
        max={max}
        value={currentValue}
        onChange={handleSliderChange}
      />
      <span className="timeline__value" data-testid="timeline-label">
        {isLive ? "Live" : formatTimestamp(currentValue)}
      </span>
      <button
        className="timeline__live-btn"
        data-testid="timeline-live"
        onClick={handleLiveClick}
        disabled={isLive}
      >
        Live
      </button>
    </div>
  );
}
