import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
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

    const slider = getByTestId("timeline-slider") as HTMLInputElement;
    const targetValue = new Date("2025-01-03T00:00:00Z").getTime();
    fireEvent.change(slider, { target: { value: String(targetValue) } });

    expect(onFilterChange).toHaveBeenCalledWith(targetValue);
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

  it("shows Live label when filterTimestamp is null", () => {
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

    expect(getByTestId("timeline-label").textContent).toBe("Live");
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
});
