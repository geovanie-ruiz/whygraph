import { useEffect, useRef } from "react";
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
    case "App": return 20;
    case "Feature": return 14;
    case "Component": return 10;
    case "Decision": return 12;
    default: return 10;
  }
}

function nodeColor(label: string): string {
  switch (label) {
    case "App": return "#1e3a5f";
    case "Feature": return "#2b8a8a";
    case "Component": return "#7ec8e3";
    case "Decision": return "#e07020";
    default: return "#999";
  }
}

function linkStroke(type: string): { dash: string; color: string } {
  switch (type) {
    case "COMPOSES": return { dash: "", color: "#999" };
    case "AFFECTS": return { dash: "6,3", color: "#e07020" };
    case "SUPERSEDES": return { dash: "2,3", color: "#c0392b" };
    default: return { dash: "", color: "#999" };
  }
}

function deriveGraphData(entities: Map<string, Entity>): {
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
        id: `composes-${entity.parent}-${entity.id}`,
        source: entity.parent,
        target: entity.id,
        type: "COMPOSES",
      });
    }

    if (isDecision(entity)) {
      for (const affectedId of entity.affects) {
        if (idSet.has(affectedId)) {
          links.push({
            id: `affects-${entity.id}-${affectedId}`,
            source: entity.id,
            target: affectedId,
            type: "AFFECTS",
          });
        }
      }
      if (entity.supersedes && idSet.has(entity.supersedes)) {
        links.push({
          id: `supersedes-${entity.id}-${entity.supersedes}`,
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
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const initializedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // One-time SVG setup: zoom, container group
  useEffect(() => {
    if (!svgRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const svg = d3.select(svgRef.current);
    const width = 800;
    const height = 600;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g");
    gRef.current = g;

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", event.transform.toString());
      });

    svg.call(zoom as never);

    // Create layer groups (persistent, not recreated)
    g.append("g").attr("class", "links");
    g.append("g").attr("class", "nodes");
  }, []);

  // Update graph data when entities change — WITHOUT tearing down the simulation
  useEffect(() => {
    const g = gRef.current;
    if (!g || !svgRef.current) return;

    const width = 800;
    const height = 600;
    const { nodes: newNodes, links: newLinks } = deriveGraphData(entities);

    // Preserve positions from existing simulation nodes
    const oldSim = simulationRef.current;
    const oldPositions = new Map<string, { x: number; y: number }>();
    if (oldSim) {
      for (const n of oldSim.nodes()) {
        if (n.x != null && n.y != null) {
          oldPositions.set(n.id, { x: n.x, y: n.y });
        }
      }
      oldSim.stop();
    }

    // Apply old positions to new nodes
    for (const n of newNodes) {
      const old = oldPositions.get(n.id);
      if (old) {
        n.x = old.x;
        n.y = old.y;
      }
    }

    // Create simulation
    const simulation = d3
      .forceSimulation<GraphNode>(newNodes)
      .force(
        "link",
        d3.forceLink<GraphNode, GraphLink>(newLinks).id((d) => d.id).distance(180),
      )
      .force("charge", d3.forceManyBody().strength(-800))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(40))
      .alphaDecay(0.05)
      .alphaMin(0.001)
      .velocityDecay(0.4);

    // If we had old positions, start cooler (don't re-explode the layout)
    if (oldPositions.size > 0) {
      simulation.alpha(0.1);
    }

    simulationRef.current = simulation;

    // --- UPDATE LINKS ---
    const linkSelection = g
      .select<SVGGElement>(".links")
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(newLinks, (d) => d.id);

    linkSelection.exit().remove();

    const linkEnter = linkSelection
      .enter()
      .append("line")
      .attr("stroke-width", 1.5)
      .attr("stroke", (d) => linkStroke(d.type).color)
      .attr("stroke-dasharray", (d) => linkStroke(d.type).dash);

    const allLinks = linkEnter.merge(linkSelection);

    // --- UPDATE NODES ---
    const nodeSelection = g
      .select<SVGGElement>(".nodes")
      .selectAll<SVGGElement, GraphNode>("g.node-group")
      .data(newNodes, (d) => d.id);

    nodeSelection.exit().remove();

    const nodeEnter = nodeSelection
      .enter()
      .append("g")
      .attr("class", "node-group")
      .attr("cursor", "pointer");

    // Draw shapes on enter
    nodeEnter.each(function (d) {
      const el = d3.select(this);
      if (d.label === "Decision") {
        const r = nodeRadius(d.label);
        el.append("rect")
          .attr("class", "node-shape")
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
          .attr("class", "node-shape")
          .attr("r", nodeRadius(d.label))
          .attr("fill", nodeColor(d.label))
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5);
      }

      // Label
      el.append("text")
        .attr("dy", nodeRadius(d.label) + 14)
        .attr("text-anchor", "middle")
        .attr("font-size", "11px")
        .attr("fill", "#333")
        .attr("pointer-events", "none")
        .text(d.displayName);
    });

    const allNodes = nodeEnter.merge(nodeSelection);

    // --- HIGHLIGHTS (reapply on every update) ---
    allNodes.select(".gap-highlight").remove();
    allNodes.select(".stale-ref-badge").remove();
    allNodes.select(".stale-ref-badge-text").remove();

    if (highlightedIds && highlightedIds.size > 0) {
      allNodes
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

    if (staleRefIds && staleRefIds.size > 0) {
      const staleNodes = allNodes.filter((d) => staleRefIds.has(d.id));
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

    // --- DRAG (with click detection) ---
    let dragged = false;
    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on("start", (event, d) => {
        dragged = false;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        dragged = true;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        if (!dragged) {
          onSelectRef.current(d.id);
        }
      });

    allNodes.call(drag);

    // --- TICK ---
    simulation.on("tick", () => {
      allLinks
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      allNodes.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [entities, highlightedIds, staleRefIds]);

  return (
    <svg
      ref={svgRef as React.RefObject<SVGSVGElement>}
      data-testid="graph-view"
      style={{ width: "100%", height: "600px", border: "1px solid #ddd", borderRadius: "8px" }}
    />
  );
}
