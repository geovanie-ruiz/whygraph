import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { Timeline, getTimestamps, filterEntitiesByTimestamp } from "./Timeline.js";
import type { Entity } from "../lib/store.js";

function makeEntity(id: string, createdAt: string, removedAt?: string): Entity {
  return {
    id,
    label: "Component",
    status: "active",
    created_at: createdAt,
    updated_at: createdAt,
    removed_at: removedAt ?? null,
    name: `Entity-${id}`,
    parent: null,
    description: null,
    refs: null,
  };
}

describe("getTimestamps", () => {
  it("extracts unique sorted timestamps from entities", () => {
    const entities = new Map<string, Entity>([
      ["a", makeEntity("a", "2025-01-03T00:00:00Z")],
      ["b", makeEntity("b", "2025-01-01T00:00:00Z")],
      ["c", makeEntity("c", "2025-01-02T00:00:00Z")],
      ["d", makeEntity("d", "2025-01-01T00:00:00Z")], // duplicate
    ]);

    const ts = getTimestamps(entities);
    expect(ts).toHaveLength(3);
    expect(ts[0]).toBeLessThan(ts[1]);
    expect(ts[1]).toBeLessThan(ts[2]);
  });

  it("includes removed_at timestamps", () => {
    const removedAt = "2025-01-10T00:00:00Z";
    const entities = new Map<string, Entity>([
      ["a", makeEntity("a", "2025-01-01T00:00:00Z", removedAt)],
    ]);

    const ts = getTimestamps(entities);
    const removedTs = new Date(removedAt).getTime();
    const createdTs = new Date("2025-01-01T00:00:00Z").getTime();

    expect(ts).toHaveLength(2);
    expect(ts).toContain(createdTs);
    expect(ts).toContain(removedTs);
  });
});

describe("filterEntitiesByTimestamp", () => {
  it("includes entities created at or before timestamp", () => {
    const entities = new Map<string, Entity>([
      ["a", makeEntity("a", "2025-01-01T00:00:00Z")],
      ["b", makeEntity("b", "2025-01-05T00:00:00Z")],
    ]);

    const cutoff = new Date("2025-01-03T00:00:00Z").getTime();
    const result = filterEntitiesByTimestamp(entities, cutoff);

    expect(result.has("a")).toBe(true);
    expect(result.has("b")).toBe(false);
  });

  it("excludes entities removed at or before timestamp", () => {
    const entities = new Map<string, Entity>([
      ["a", makeEntity("a", "2025-01-01T00:00:00Z", "2025-01-02T00:00:00Z")],
    ]);

    const cutoff = new Date("2025-01-03T00:00:00Z").getTime();
    const result = filterEntitiesByTimestamp(entities, cutoff);

    expect(result.has("a")).toBe(false);
  });
});

describe("Timeline component", () => {
  it("renders slider element when there are 2+ timestamps", () => {
    const entities = new Map<string, Entity>([
      ["a", makeEntity("a", "2025-01-01T00:00:00Z")],
      ["b", makeEntity("b", "2025-01-05T00:00:00Z")],
    ]);

    const { getByTestId } = render(
      <Timeline
        entities={entities}
        filterTimestamp={null}
        onFilterChange={vi.fn()}
      />,
    );

    expect(getByTestId("timeline-slider")).toBeTruthy();
    expect(getByTestId("timeline-label")).toBeTruthy();
    expect(getByTestId("timeline-live")).toBeTruthy();
  });

  it("returns null when fewer than 2 timestamps", () => {
    const entities = new Map<string, Entity>([
      ["a", makeEntity("a", "2025-01-01T00:00:00Z")],
    ]);

    const { container } = render(
      <Timeline
        entities={entities}
        filterTimestamp={null}
        onFilterChange={vi.fn()}
      />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("slider change calls onFilterChange with new timestamp", () => {
    const onFilterChange = vi.fn();
    const ts1 = new Date("2025-01-01T00:00:00Z").getTime();
    const entities = new Map<string, Entity>([
      ["a", makeEntity("a", "2025-01-01T00:00:00Z")],
      ["b", makeEntity("b", "2025-01-05T00:00:00Z")],
    ]);

    const { getByTestId } = render(
      <Timeline
        entities={entities}
        filterTimestamp={null}
        onFilterChange={onFilterChange}
      />,
    );

    // Slider uses indices (0-based), not raw timestamps
    const slider = getByTestId("timeline-slider") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "0" } });

    expect(onFilterChange).toHaveBeenCalledWith(ts1);
  });

  it("displays formatted timestamp when filter is active", () => {
    const entities = new Map<string, Entity>([
      ["a", makeEntity("a", "2025-01-01T00:00:00Z")],
      ["b", makeEntity("b", "2025-01-05T00:00:00Z")],
    ]);

    const ts = new Date("2025-01-03T00:00:00Z").getTime();
    const { getByTestId } = render(
      <Timeline
        entities={entities}
        filterTimestamp={ts}
        onFilterChange={vi.fn()}
      />,
    );

    const label = getByTestId("timeline-label");
    // Should not say "Live" since we have an active filter
    expect(label.textContent).not.toBe("Live");
    // Should contain some date string
    expect(label.textContent!.length).toBeGreaterThan(0);
  });

  it("shows formatted timestamp in label when filterTimestamp is null (live = last frame)", () => {
    const entities = new Map<string, Entity>([
      ["a", makeEntity("a", "2025-01-01T00:00:00Z")],
      ["b", makeEntity("b", "2025-01-05T00:00:00Z")],
    ]);

    const { getByTestId } = render(
      <Timeline
        entities={entities}
        filterTimestamp={null}
        onFilterChange={vi.fn()}
      />,
    );

    // The label always shows a formatted timestamp; "Live" is on the separate Live button
    const label = getByTestId("timeline-label");
    expect(label.textContent).not.toBe("Live");
    expect(label.textContent!.length).toBeGreaterThan(0);

    // The Live button is disabled when no filter is active (already at live/last frame)
    const liveBtn = getByTestId("timeline-live") as HTMLButtonElement;
    expect(liveBtn.disabled).toBe(true);
  });

  it("Live button calls onFilterChange(null)", () => {
    const onFilterChange = vi.fn();
    const entities = new Map<string, Entity>([
      ["a", makeEntity("a", "2025-01-01T00:00:00Z")],
      ["b", makeEntity("b", "2025-01-05T00:00:00Z")],
    ]);

    const ts = new Date("2025-01-03T00:00:00Z").getTime();
    const { getByTestId } = render(
      <Timeline
        entities={entities}
        filterTimestamp={ts}
        onFilterChange={onFilterChange}
      />,
    );

    fireEvent.click(getByTestId("timeline-live"));
    expect(onFilterChange).toHaveBeenCalledWith(null);
  });

  describe("play/pause", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const ts1 = new Date("2025-01-01T00:00:00Z").getTime();
    const ts2 = new Date("2025-01-05T00:00:00Z").getTime();

    function makeTestEntities() {
      return new Map<string, Entity>([
        ["a", makeEntity("a", "2025-01-01T00:00:00Z")],
        ["b", makeEntity("b", "2025-01-05T00:00:00Z")],
      ]);
    }

    it("starts playback from beginning when live (filterTimestamp=null)", () => {
      const onFilterChange = vi.fn();
      const entities = makeTestEntities();

      const { getByTestId } = render(
        <Timeline
          entities={entities}
          filterTimestamp={null}
          onFilterChange={onFilterChange}
        />,
      );

      fireEvent.click(getByTestId("timeline-play"));

      // Should start at first timestamp
      expect(onFilterChange).toHaveBeenCalledWith(ts1);

      // Advance timer by 1000ms to trigger next frame
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onFilterChange).toHaveBeenCalledWith(ts2);
    });

    it("pauses when play button clicked while already playing", () => {
      const onFilterChange = vi.fn();
      const entities = makeTestEntities();

      const { getByTestId } = render(
        <Timeline
          entities={entities}
          filterTimestamp={null}
          onFilterChange={onFilterChange}
        />,
      );

      const playBtn = getByTestId("timeline-play");

      // Start playing
      fireEvent.click(playBtn);
      expect(onFilterChange).toHaveBeenCalledWith(ts1);

      // Click again to pause
      fireEvent.click(playBtn);

      // Advance timer -- onFilterChange should NOT be called again after pause
      const callCountAfterPause = onFilterChange.mock.calls.length;
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(onFilterChange.mock.calls.length).toBe(callCountAfterPause);
    });

    it("reaches end and returns to live (onFilterChange(null))", () => {
      const onFilterChange = vi.fn();
      const entities = makeTestEntities();

      const { getByTestId } = render(
        <Timeline
          entities={entities}
          filterTimestamp={null}
          onFilterChange={onFilterChange}
        />,
      );

      fireEvent.click(getByTestId("timeline-play"));

      // Frame 0: ts1 (called synchronously on click)
      expect(onFilterChange).toHaveBeenCalledWith(ts1);

      // Frame 1: ts2 (after 1000ms)
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onFilterChange).toHaveBeenCalledWith(ts2);

      // Frame 2: end -- should call onFilterChange(null) to return to live
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onFilterChange).toHaveBeenCalledWith(null);
    });

    it("restarts from beginning when at last frame", () => {
      const onFilterChange = vi.fn();
      const entities = makeTestEntities();

      const { getByTestId } = render(
        <Timeline
          entities={entities}
          filterTimestamp={ts2}
          onFilterChange={onFilterChange}
        />,
      );

      fireEvent.click(getByTestId("timeline-play"));

      // ts2 is the last timestamp (index 1, which is >= length - 1),
      // so playback should restart from index 0
      expect(onFilterChange).toHaveBeenCalledWith(ts1);
    });

    it("slider change stops playback", () => {
      const onFilterChange = vi.fn();
      const entities = makeTestEntities();

      const { getByTestId } = render(
        <Timeline
          entities={entities}
          filterTimestamp={null}
          onFilterChange={onFilterChange}
        />,
      );

      // Start playing
      fireEvent.click(getByTestId("timeline-play"));
      expect(onFilterChange).toHaveBeenCalledWith(ts1);

      // Change slider -- should stop playback
      const slider = getByTestId("timeline-slider") as HTMLInputElement;
      fireEvent.change(slider, { target: { value: "0" } });

      // Record call count after slider change; no further play callbacks should fire
      const callCountAfterSlider = onFilterChange.mock.calls.length;
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(onFilterChange.mock.calls.length).toBe(callCountAfterSlider);
    });
  });
});
