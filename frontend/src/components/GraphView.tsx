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
  highlightedIds?: Set<string>;
  staleRefIds?: Set<string>;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  displayName: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
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
        source: entity.parent,
        target: entity.id,
        type: "COMPOSES",
      });
    }

    if (isDecision(entity)) {
      for (const affectedId of entity.affects) {
        if (idSet.has(affectedId)) {
          links.push({
            source: entity.id,
            target: affectedId,
            type: "AFFECTS",
          });
        }
      }
      if (entity.supersedes && idSet.has(entity.supersedes)) {
        links.push({
          source: entity.id,
          target: entity.supersedes,
          type: "SUPERSEDES",
        });
      }
    }
  }

  return { nodes, links };
}

export function GraphView({ entities, onSelect, highlightedIds, staleRefIds }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(
    null,
  );

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

    // Clear previous content
    svg.selectAll("*").remove();

    const { nodes, links } = buildGraph(entities);

    if (nodes.length === 0) return;

    // Container group for zoom/pan
    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", event.transform.toString());
      });

    svg.call(zoom as unknown as (selection: d3.Selection<SVGSVGElement | null, unknown, null, undefined>) => void);

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

    // Draw links
    const link = g
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5)
      .attr("stroke", (d) => linkStroke(d.type).color)
      .attr("stroke-dasharray", (d) => linkStroke(d.type).dash);

    // Draw node groups
    const node = g
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", handleNodeClick as unknown as (this: SVGGElement, event: MouseEvent, d: GraphNode) => void);

    // Node shapes
    node.each(function (d) {
      const el = d3.select(this);
      if (d.label === "Decision") {
        // Diamond shape for decisions
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

    // Gap highlight: pulsing ring on highlighted nodes
    if (highlightedIds && highlightedIds.size > 0) {
      node
        .filter((d) => highlightedIds.has(d.id))
        .append("circle")
        .attr("class", "gap-highlight")
        .attr("r", (d) => nodeRadius(d.label) + 5)
        .attr("fill", "none")
        .attr("stroke", "#ff6b35")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,2")
        .attr("opacity", 0.8);
    }

    // Stale ref badge: warning "!" indicator
    if (staleRefIds && staleRefIds.size > 0) {
      const staleNodes = node.filter((d) => staleRefIds.has(d.id));
      staleNodes
        .append("circle")
        .attr("class", "stale-ref-badge")
        .attr("cx", (d) => nodeRadius(d.label))
        .attr("cy", (d) => -nodeRadius(d.label))
        .attr("r", 7)
        .attr("fill", "#e74c3c")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);
      staleNodes
        .append("text")
        .attr("class", "stale-ref-badge-text")
        .attr("x", (d) => nodeRadius(d.label))
        .attr("y", (d) => -nodeRadius(d.label) + 4)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("fill", "#fff")
        .attr("pointer-events", "none")
        .text("!");
    }

    // Node labels
    node
      .append("text")
      .text((d) => d.displayName)
      .attr("dy", (d) => nodeRadius(d.label) + 14)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#333")
      .attr("pointer-events", "none");

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

    return () => {
      simulation.stop();
    };
  }, [entities, handleNodeClick, highlightedIds, staleRefIds]);

  return (
    <svg
      ref={svgRef as React.RefObject<SVGSVGElement>}
      style={{ width: "100%", height: "600px", border: "1px solid #ddd", borderRadius: "8px" }}
    />
  );
}
