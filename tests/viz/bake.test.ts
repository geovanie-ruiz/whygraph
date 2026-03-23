import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  WhyEvent,
  NodeAddedEvent,
  EdgeAddedEvent,
} from "../../src/core/types.js";
import { bakeViz } from "../../src/viz/bake.js";

function makeNodeAdded(
  id: string,
  label: "App" | "Feature" | "Component" | "Decision" = "Feature",
  name: string = id,
  timestamp: string = "2026-03-22T00:00:00Z"
): NodeAddedEvent {
  return {
    type: "node_added",
    timestamp,
    id,
    label,
    properties: { name },
  };
}

function makeEdgeAdded(
  id: string,
  from: string,
  to: string,
  label: "COMPOSES" | "AFFECTS" | "SUPERSEDES" | "DEPRECATES" = "COMPOSES",
  timestamp: string = "2026-03-22T00:00:00Z"
): EdgeAddedEvent {
  return {
    type: "edge_added",
    timestamp,
    id,
    label,
    from,
    to,
  };
}

describe("bakeViz", () => {
  let realDateNow: () => number;

  beforeEach(() => {
    realDateNow = Date.now;
    Date.now = vi.fn(() => new Date("2026-03-23T12:00:00Z").getTime());
  });

  afterEach(() => {
    Date.now = realDateNow;
  });

  it("returns valid HTML with inlined D3 for a simple graph", () => {
    const events: WhyEvent[] = [
      makeNodeAdded("app-1", "App", "MyApp", "2026-03-22T00:00:00Z"),
      makeNodeAdded("feat-1", "Feature", "Auth", "2026-03-22T01:00:00Z"),
      makeEdgeAdded("edge-1", "app-1", "feat-1", "COMPOSES", "2026-03-22T01:00:00Z"),
    ];

    const html = bakeViz(events, 0);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    // D3 should be inlined
    expect(html).toContain("d3");
    // Snapshots should be present as JSON
    expect(html).toContain("SNAPSHOTS");
    // Stale banner hidden on fresh bake
    expect(html).toContain("display:none");
  });

  it("groups events by unique timestamp and creates one snapshot per", () => {
    const events: WhyEvent[] = [
      makeNodeAdded("app-1", "App", "MyApp", "2026-03-22T00:00:00Z"),
      makeNodeAdded("feat-1", "Feature", "Auth", "2026-03-22T01:00:00Z"),
      makeEdgeAdded("edge-1", "app-1", "feat-1", "COMPOSES", "2026-03-22T01:00:00Z"),
      makeNodeAdded("feat-2", "Feature", "Billing", "2026-03-22T02:00:00Z"),
    ];

    const html = bakeViz(events, 0);

    // Extract snapshots from the HTML
    const match = html.match(/const SNAPSHOTS = (\[.*?\]);/s);
    expect(match).not.toBeNull();
    const snapshots = JSON.parse(match![1]);

    // 3 unique timestamps => 3 snapshots
    expect(snapshots).toHaveLength(3);
    expect(snapshots[0].timestamp).toBe("2026-03-22T00:00:00Z");
    expect(snapshots[1].timestamp).toBe("2026-03-22T01:00:00Z");
    expect(snapshots[2].timestamp).toBe("2026-03-22T02:00:00Z");
  });

  it("serializes full graph state in each snapshot", () => {
    const events: WhyEvent[] = [
      makeNodeAdded("app-1", "App", "MyApp", "2026-03-22T00:00:00Z"),
      makeNodeAdded("feat-1", "Feature", "Auth", "2026-03-22T01:00:00Z"),
      makeEdgeAdded("edge-1", "app-1", "feat-1", "COMPOSES", "2026-03-22T01:00:00Z"),
    ];

    const html = bakeViz(events, 0);
    const match = html.match(/const SNAPSHOTS = (\[.*?\]);/s);
    const snapshots = JSON.parse(match![1]);

    // First snapshot: just app-1
    expect(snapshots[0].graph.nodes).toHaveLength(1);
    expect(snapshots[0].graph.nodes[0].id).toBe("app-1");
    expect(snapshots[0].graph.edges).toHaveLength(0);

    // Second snapshot: app-1 + feat-1 + edge
    expect(snapshots[1].graph.nodes).toHaveLength(2);
    expect(snapshots[1].graph.edges).toHaveLength(1);
    expect(snapshots[1].graph.edges[0].id).toBe("edge-1");
    expect(snapshots[1].graph.edges[0].from).toBe("app-1");
    expect(snapshots[1].graph.edges[0].to).toBe("feat-1");
  });

  it("includes node attributes in snapshots", () => {
    const events: WhyEvent[] = [
      makeNodeAdded("app-1", "App", "MyApp", "2026-03-22T00:00:00Z"),
    ];

    const html = bakeViz(events, 0);
    const match = html.match(/const SNAPSHOTS = (\[.*?\]);/s);
    const snapshots = JSON.parse(match![1]);

    const node = snapshots[0].graph.nodes[0];
    expect(node.id).toBe("app-1");
    expect(node.label).toBe("App");
    expect(node.name).toBe("MyApp");
  });

  it("includes edge attributes in snapshots", () => {
    const events: WhyEvent[] = [
      makeNodeAdded("n1", "Feature", "F1", "2026-03-22T00:00:00Z"),
      makeNodeAdded("n2", "Feature", "F2", "2026-03-22T00:00:00Z"),
      makeEdgeAdded("e1", "n1", "n2", "AFFECTS", "2026-03-22T01:00:00Z"),
    ];

    const html = bakeViz(events, 0);
    const match = html.match(/const SNAPSHOTS = (\[.*?\]);/s);
    const snapshots = JSON.parse(match![1]);

    const edge = snapshots[1].graph.edges[0];
    expect(edge.label).toBe("AFFECTS");
  });

  it("handles empty events array", () => {
    const html = bakeViz([], 0);

    expect(html).toContain("<!DOCTYPE html>");
    const match = html.match(/const SNAPSHOTS = (\[.*?\]);/s);
    expect(match).not.toBeNull();
    const snapshots = JSON.parse(match![1]);
    expect(snapshots).toHaveLength(0);
  });

  it("includes BAKED_AT timestamp", () => {
    const html = bakeViz([], 0);
    expect(html).toContain("BAKED_AT");
    expect(html).toContain("2026-03-23");
  });

  it("includes REVIEW_COUNT", () => {
    const html = bakeViz([], 5);
    const match = html.match(/const REVIEW_COUNT = (\d+);/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("5");
  });

  it("sorts snapshots chronologically", () => {
    const events: WhyEvent[] = [
      makeNodeAdded("n2", "Feature", "F2", "2026-03-22T02:00:00Z"),
      makeNodeAdded("n1", "Feature", "F1", "2026-03-22T01:00:00Z"),
    ];

    const html = bakeViz(events, 0);
    const match = html.match(/const SNAPSHOTS = (\[.*?\]);/s);
    const snapshots = JSON.parse(match![1]);

    expect(snapshots[0].timestamp).toBe("2026-03-22T01:00:00Z");
    expect(snapshots[1].timestamp).toBe("2026-03-22T02:00:00Z");
  });

  it("uses the HTML template file", () => {
    const templatePath = path.resolve(
      import.meta.dirname,
      "../../src/viz/template/index.html"
    );
    expect(fs.existsSync(templatePath)).toBe(true);
  });
});
