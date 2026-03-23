import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  WhyEvent,
  NodeAddedEvent,
  EdgeAddedEvent,
  NodePatchedEvent,
  EdgeRemovedEvent,
  NodeRemovedEvent,
} from "../../src/core/types.js";
import { buildGraph, buildGraphAt } from "../../src/core/projection.js";

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

function makeNodePatched(
  id: string,
  properties: Record<string, unknown>,
  timestamp: string = "2026-03-22T00:00:00Z"
): NodePatchedEvent {
  return {
    type: "node_patched",
    timestamp,
    id,
    properties,
  };
}

function makeEdgeRemoved(
  id: string,
  timestamp: string = "2026-03-22T00:00:00Z"
): EdgeRemovedEvent {
  return {
    type: "edge_removed",
    timestamp,
    id,
  };
}

function makeNodeRemoved(
  id: string,
  timestamp: string = "2026-03-22T00:00:00Z"
): NodeRemovedEvent {
  return {
    type: "node_removed",
    timestamp,
    id,
  };
}

describe("buildGraph", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns empty graph for empty events array", () => {
    const graph = buildGraph([]);
    expect(graph.order).toBe(0);
    expect(graph.size).toBe(0);
  });

  it("correctly projects a sequence of node and edge events", () => {
    const events: WhyEvent[] = [
      makeNodeAdded("app-1", "App", "MyApp"),
      makeNodeAdded("feat-1", "Feature", "Auth"),
      makeEdgeAdded("edge-1", "app-1", "feat-1", "COMPOSES"),
    ];

    const graph = buildGraph(events);

    expect(graph.order).toBe(2);
    expect(graph.size).toBe(1);
    expect(graph.getNodeAttributes("app-1")).toEqual({
      label: "App",
      name: "MyApp",
    });
    expect(graph.getNodeAttributes("feat-1")).toEqual({
      label: "Feature",
      name: "Auth",
    });
    expect(graph.getEdgeAttributes("edge-1")).toEqual({ label: "COMPOSES" });
    expect(graph.source("edge-1")).toBe("app-1");
    expect(graph.target("edge-1")).toBe("feat-1");
  });

  it("applies node_patched events with merged attributes", () => {
    const events: WhyEvent[] = [
      makeNodeAdded("feat-1", "Feature", "Auth"),
      makeNodePatched("feat-1", {
        description: "Authentication module",
        name: "AuthV2",
      }),
    ];

    const graph = buildGraph(events);
    const attrs = graph.getNodeAttributes("feat-1");

    expect(attrs.name).toBe("AuthV2");
    expect(attrs.description).toBe("Authentication module");
    expect(attrs.label).toBe("Feature");
  });

  it("handles edge_removed events", () => {
    const events: WhyEvent[] = [
      makeNodeAdded("a", "Feature", "A"),
      makeNodeAdded("b", "Feature", "B"),
      makeEdgeAdded("e-1", "a", "b", "AFFECTS"),
      makeEdgeRemoved("e-1"),
    ];

    const graph = buildGraph(events);

    expect(graph.order).toBe(2);
    expect(graph.size).toBe(0);
    expect(graph.hasEdge("e-1")).toBe(false);
  });

  it("handles node_removed events", () => {
    const events: WhyEvent[] = [
      makeNodeAdded("a", "Feature", "A"),
      makeNodeAdded("b", "Feature", "B"),
      makeEdgeAdded("e-1", "a", "b", "COMPOSES"),
      makeNodeRemoved("b"),
    ];

    const graph = buildGraph(events);

    expect(graph.order).toBe(1);
    expect(graph.hasNode("b")).toBe(false);
    // graphology.dropNode also drops associated edges
    expect(graph.size).toBe(0);
  });

  it("skips edge_added to non-existent source node with warning", () => {
    const events: WhyEvent[] = [
      makeNodeAdded("b", "Feature", "B"),
      makeEdgeAdded("e-1", "nonexistent", "b", "COMPOSES"),
    ];

    const graph = buildGraph(events);

    expect(graph.size).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("skips edge_added to non-existent target node with warning", () => {
    const events: WhyEvent[] = [
      makeNodeAdded("a", "Feature", "A"),
      makeEdgeAdded("e-1", "a", "nonexistent", "COMPOSES"),
    ];

    const graph = buildGraph(events);

    expect(graph.size).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("skips node_patched for non-existent node with warning", () => {
    const events: WhyEvent[] = [
      makeNodePatched("nonexistent", { name: "Nope" }),
    ];

    const graph = buildGraph(events);

    expect(graph.order).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("skips edge_removed for non-existent edge with warning", () => {
    const events: WhyEvent[] = [makeEdgeRemoved("nonexistent")];

    const graph = buildGraph(events);

    expect(graph.size).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("skips node_removed for non-existent node with warning", () => {
    const events: WhyEvent[] = [makeNodeRemoved("nonexistent")];

    const graph = buildGraph(events);

    expect(graph.order).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("skips duplicate node_added with warning", () => {
    const events: WhyEvent[] = [
      makeNodeAdded("a", "Feature", "A"),
      makeNodeAdded("a", "Feature", "A-duplicate"),
    ];

    const graph = buildGraph(events);

    // First one wins, second is skipped
    expect(graph.order).toBe(1);
    expect(graph.getNodeAttribute("a", "name")).toBe("A");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("skips duplicate edge_added with warning", () => {
    const events: WhyEvent[] = [
      makeNodeAdded("a", "Feature", "A"),
      makeNodeAdded("b", "Feature", "B"),
      makeEdgeAdded("e-1", "a", "b", "COMPOSES"),
      makeEdgeAdded("e-1", "a", "b", "AFFECTS"),
    ];

    const graph = buildGraph(events);

    expect(graph.size).toBe(1);
    expect(graph.getEdgeAttribute("e-1", "label")).toBe("COMPOSES");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

describe("buildGraphAt", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const events: WhyEvent[] = [
    makeNodeAdded("a", "Feature", "A", "2026-01-01T00:00:00Z"),
    makeNodeAdded("b", "Feature", "B", "2026-02-01T00:00:00Z"),
    makeEdgeAdded("e-1", "a", "b", "COMPOSES", "2026-03-01T00:00:00Z"),
    makeNodePatched("a", { description: "Updated" }, "2026-04-01T00:00:00Z"),
  ];

  it("returns empty graph when cutoff is before first event", () => {
    const graph = buildGraphAt(events, "2025-12-31T00:00:00Z");

    expect(graph.order).toBe(0);
    expect(graph.size).toBe(0);
  });

  it("includes only events at or before the cutoff", () => {
    const graph = buildGraphAt(events, "2026-02-01T00:00:00Z");

    expect(graph.order).toBe(2);
    expect(graph.size).toBe(0); // edge not yet added
    expect(graph.hasNode("a")).toBe(true);
    expect(graph.hasNode("b")).toBe(true);
  });

  it("includes event exactly at the cutoff timestamp", () => {
    const graph = buildGraphAt(events, "2026-03-01T00:00:00Z");

    expect(graph.order).toBe(2);
    expect(graph.size).toBe(1);
    expect(graph.hasEdge("e-1")).toBe(true);
  });

  it("returns same result as buildGraph when cutoff is after all events", () => {
    const graphFull = buildGraph(events);
    const graphAt = buildGraphAt(events, "2099-01-01T00:00:00Z");

    expect(graphAt.order).toBe(graphFull.order);
    expect(graphAt.size).toBe(graphFull.size);

    graphFull.forEachNode((nodeId, attrs) => {
      expect(graphAt.getNodeAttributes(nodeId)).toEqual(attrs);
    });

    graphFull.forEachEdge((edgeId, attrs) => {
      expect(graphAt.getEdgeAttributes(edgeId)).toEqual(attrs);
    });
  });
});
