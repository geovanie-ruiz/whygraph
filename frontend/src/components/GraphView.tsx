import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type {
  Entity,
  StructuralNodeEntity,
  DecisionNodeEntity,
} from "../lib/store.js";

export interface GraphViewProps {
  entities: Map<string, Entity>;
  onSelect: (entityId: string) => void;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  displayName: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  type: "COMPOSES" | "AFFECTS" | "SUPERSEDES";
}

function isStructural(e: Entity): e is StructuralNodeEntity {
  return "name" in e;
}

function isDecision(e: Entity): e is DecisionNodeEntity {
  return "title" in e;
}

function getDisplayName(entity: Entity): string {
  if (isDecision(entity)) return entity.title;
  return (entity as StructuralNodeEntity).name;
}

function nodeRadius(label: string): number {
  switch (label) {
    case "App":
      return 20;
    case "Feature":
      return 14;
    case "Component":
      return 10;
    case "Decision":
      return 12;
    default:
      return 10;
  }
}

function nodeColor(label: string): string {
  switch (label) {
    case "App":
      return "#1e3a5f";
    case "Feature":
      return "#2b8a8a";
    case "Component":
      return "#7ec8e3";
    case "Decision":
      return "#e07020";
    default:
      return "#999";
  }
}

function linkStroke(type: string): { dash: string; color: string } {
  switch (type) {
    case "COMPOSES":
      return { dash: "", color: "#999" };
    case "AFFECTS":
      return { dash: "6,3", color: "#e07020" };
    case "SUPERSEDES":
      return { dash: "2,3", color: "#c0392b" };
    default:
      return { dash: "", color: "#999" };
  }
}

function buildGraph(entities: Map<string, Entity>): {
  nodes: GraphNode[];
  links: GraphLink[];
} {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const idSet = new Set(entities.keys());

  for (const entity of entities.values()) {
    nodes.push({
      id: entity.id,
      label: entity.label,
      displayName: getDisplayName(entity),
    });

    if (isStructural(entity) && entity.parent && idSet.has(entity.parent)) {
      links.push({
        id: `${entity.parent}-COMPOSES-${entity.id}`,
        source: entity.parent,
        target: entity.id,
        type: "COMPOSES",
      });
    }

    if (isDecision(entity)) {
      for (const affectedId of entity.affects) {
        if (idSet.has(affectedId)) {
          links.push({
            id: `${entity.id}-AFFECTS-${affectedId}`,
            source: entity.id,
            target: affectedId,
            type: "AFFECTS",
          });
        }
      }
      if (entity.supersedes && idSet.has(entity.supersedes)) {
        links.push({
          id: `${entity.id}-SUPERSEDES-${entity.supersedes}`,
          source: entity.id,
          target: entity.supersedes,
          type: "SUPERSEDES",
        });
      }
    }
  }

  return { nodes, links };
}

const TRANSITION_DURATION = 300;

export function GraphView({ entities, onSelect }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(
    null,
  );
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const initializedRef = useRef(false);

  const handleNodeClick = useCallback(
    (_event: MouseEvent, d: GraphNode) => {
      onSelect(d.id);
    },
    [onSelect],
  );

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svgRef.current) return;

    const width = 800;
    const height = 600;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const { nodes, links } = buildGraph(entities);

    // First-time initialization: create container group, zoom
    if (!initializedRef.current) {
      svg.selectAll("*").remove();
      const g = svg.append("g");
      gRef.current = g;
      g.append("g").attr("class", "links");
      g.append("g").attr("class", "nodes");

      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          g.attr("transform", event.transform.toString());
        });

      svg.call(zoom as unknown as (selection: d3.Selection<SVGSVGElement | null, unknown, null, undefined>) => void);
      initializedRef.current = true;
    }

    const g = gRef.current!;

    // Stop previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    if (nodes.length === 0) {
      g.select(".links").selectAll("line").remove();
      g.select(".nodes").selectAll("g").remove();
      return;
    }

    // Preserve positions from previous simulation nodes
    const prevNodes = simulationRef.current?.nodes() ?? [];
    const prevPositions = new Map<string, { x: number; y: number }>();
    for (const n of prevNodes) {
      if (n.x !== undefined && n.y !== undefined) {
        prevPositions.set(n.id, { x: n.x, y: n.y });
      }
    }
    for (const n of nodes) {
      const prev = prevPositions.get(n.id);
      if (prev) {
        n.x = prev.x;
        n.y = prev.y;
      }
    }

    // Force simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(100),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    simulationRef.current = simulation;

    // Update links with enter/exit transitions
    const linkSelection = g
      .select(".links")
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(links, (d) => d.id);

    linkSelection.exit()
      .transition()
      .duration(TRANSITION_DURATION)
      .attr("stroke-opacity", 0)
      .remove();

    const linkEnter = linkSelection.enter()
      .append("line")
      .attr("stroke-width", 1.5)
      .attr("stroke", (d) => linkStroke(d.type).color)
      .attr("stroke-dasharray", (d) => linkStroke(d.type).dash)
      .attr("stroke-opacity", 0);

    linkEnter.transition()
      .duration(TRANSITION_DURATION)
      .attr("stroke-opacity", 1);

    const link = linkEnter.merge(linkSelection);

    // Update existing links
    linkSelection
      .attr("stroke", (d) => linkStroke(d.type).color)
      .attr("stroke-dasharray", (d) => linkStroke(d.type).dash);

    // Update nodes with enter/exit transitions
    const nodeSelection = g
      .select(".nodes")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes, (d) => d.id);

    // Exit: fade out and remove
    nodeSelection.exit()
      .transition()
      .duration(TRANSITION_DURATION)
      .attr("opacity", 0)
      .remove();

    // Enter: create new node groups
    const nodeEnter = nodeSelection.enter()
      .append("g")
      .attr("cursor", "pointer")
      .attr("opacity", 0)
      .on("click", handleNodeClick as unknown as (this: SVGGElement, event: MouseEvent, d: GraphNode) => void);

    // Add shapes to new nodes
    nodeEnter.each(function (d) {
      const el = d3.select(this);
      if (d.label === "Decision") {
        const r = nodeRadius(d.label);
        el.append("rect")
          .attr("width", r * 1.4)
          .attr("height", r * 1.4)
          .attr("x", (-r * 1.4) / 2)
          .attr("y", (-r * 1.4) / 2)
          .attr("transform", "rotate(45)")
          .attr("fill", nodeColor(d.label))
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5);
      } else {
        el.append("circle")
          .attr("r", nodeRadius(d.label))
          .attr("fill", nodeColor(d.label))
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5);
      }
    });

    // Add labels to new nodes
    nodeEnter
      .append("text")
      .text((d) => d.displayName)
      .attr("dy", (d) => nodeRadius(d.label) + 14)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#333")
      .attr("pointer-events", "none");

    // Fade in new nodes
    nodeEnter.transition()
      .duration(TRANSITION_DURATION)
      .attr("opacity", 1);

    // Merge enter + update
    const node = nodeEnter.merge(nodeSelection);

    // Update existing node labels/colors for UPDATED events
    nodeSelection.each(function (d) {
      const el = d3.select(this);
      el.select("text").text(d.displayName);
      el.select("circle").attr("fill", nodeColor(d.label));
      el.select("rect").attr("fill", nodeColor(d.label));
    });

    // Re-attach click handler to merged selection
    node.on("click", handleNodeClick as unknown as (this: SVGGElement, event: MouseEvent, d: GraphNode) => void);

    // Drag behavior
    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on("start", (_event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
        if (!_event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (_event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
        if (!_event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    // Tick handler
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Reheat simulation gently for incremental updates
    simulation.alpha(0.3).restart();

    return () => {
      simulation.stop();
    };
  }, [entities, handleNodeClick]);

  return (
    <svg
      ref={svgRef as React.RefObject<SVGSVGElement>}
      data-testid="graph-view"
      style={{ width: "100%", height: "600px", border: "1px solid #ddd", borderRadius: "8px" }}
    />
  );
}
