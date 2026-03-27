import { useMemo, useCallback, useEffect, useRef, useState } from "react";
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
    if (entity.removed_at) {
      const ts = new Date(entity.removed_at).getTime();
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
  const timestampsRef = useRef(timestamps);
  timestampsRef.current = timestamps;

  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playIndexRef = useRef<number>(0);

  const stopPlay = useCallback(() => {
    if (playTimerRef.current !== null) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      stopPlay();
      const index = Number(e.target.value);
      onFilterChange(timestampsRef.current[index]);
    },
    [onFilterChange, stopPlay],
  );

  const handleLiveClick = useCallback(() => {
    stopPlay();
    onFilterChange(null);
  }, [onFilterChange, stopPlay]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      stopPlay();
      return;
    }

    const ts = timestampsRef.current;

    // Find start: if live or at last frame, restart from beginning
    let startIndex = filterTimestamp === null
      ? 0
      : ts.indexOf(filterTimestamp);

    if (startIndex < 0 || startIndex >= ts.length - 1) {
      startIndex = 0;
    }

    playIndexRef.current = startIndex;
    setIsPlaying(true);
    onFilterChange(ts[startIndex]);

    playTimerRef.current = setInterval(() => {
      playIndexRef.current += 1;
      const current = timestampsRef.current;
      if (playIndexRef.current >= current.length) {
        clearInterval(playTimerRef.current!);
        playTimerRef.current = null;
        setIsPlaying(false);
        onFilterChange(null);
        return;
      }
      onFilterChange(current[playIndexRef.current]);
    }, 1000);
  }, [isPlaying, filterTimestamp, onFilterChange, stopPlay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playTimerRef.current !== null) clearInterval(playTimerRef.current);
    };
  }, []);

  if (timestamps.length < 2) {
    return null;
  }

  // Map filterTimestamp back to an index for the slider
  const lastIndex = timestamps.length - 1;
  const currentIndex = filterTimestamp === null
    ? lastIndex
    : Math.max(0, timestamps.indexOf(filterTimestamp));

  const isLive = filterTimestamp === null;

  return (
    <div className="timeline" data-testid="timeline">
      <label htmlFor="timeline-slider" className="timeline__label">
        Timeline:
      </label>
      <button
        className="timeline__play-btn"
        data-testid="timeline-play"
        onClick={handlePlayPause}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>
      <input
        id="timeline-slider"
        className="timeline__slider"
        data-testid="timeline-slider"
        type="range"
        min={0}
        max={lastIndex}
        step={1}
        value={currentIndex}
        onChange={handleSliderChange}
      />
      <span className="timeline__value" data-testid="timeline-label">
        {formatTimestamp(timestamps[currentIndex])}
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
