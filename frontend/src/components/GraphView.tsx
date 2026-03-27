import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import * as d3 from "d3";
import type {
  Entity,
  StructuralNodeEntity,
  DecisionNodeEntity,
} from "../lib/store.js";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GraphViewHandle {
  zoomToNode: (id: string) => void;
}

export interface GraphViewProps {
  entities: Map<string, Entity>;
  onSelect: (entityId: string) => void;
  onDeselect?: () => void;
  selectedEntityId?: string | null;
  onFitAll?: () => void;
  highlightedIds?: Set<string>;
  staleRefIds?: Set<string>;
  errorIds?: Set<string>;
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

// Split a label into lines at word / camelCase boundaries, max maxChars per line.
function splitLabel(text: string, maxChars = 14): string[] {
  if (text.length <= maxChars) return [text];
  const spaced = text.replace(/([a-z])([A-Z])/g, "$1 $2");
  const words = spaced.split(/[\s\-_]+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + " " + word).length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

// Compute where to anchor a node's label so it points away from its neighbours.
function computeLabelOffset(
  node: GraphNode,
  all: GraphNode[],
): { dx: number; dy: number; anchor: "start" | "middle" | "end" } {
  const dist = nodeRadius(node.label) + 16;
  const nx = node.x ?? 0;
  const ny = node.y ?? 0;

  const nearby = all.filter(
    (n) => n.id !== node.id && Math.hypot((n.x ?? 0) - nx, (n.y ?? 0) - ny) < 180,
  );

  if (nearby.length === 0) return { dx: 0, dy: dist, anchor: "middle" };

  const cx = nearby.reduce((s, n) => s + (n.x ?? 0), 0) / nearby.length;
  const cy = nearby.reduce((s, n) => s + (n.y ?? 0), 0) / nearby.length;
  const vx = nx - cx;
  const vy = ny - cy;
  const mag = Math.hypot(vx, vy);

  if (mag < 5) return { dx: 0, dy: dist, anchor: "middle" };

  const dx = (vx / mag) * dist;
  const dy = (vy / mag) * dist;
  const anchor = dx > dist * 0.35 ? "start" : dx < -dist * 0.35 ? "end" : "middle";
  return { dx, dy, anchor };
}

// Apply label offsets to the text + tspan elements in a node selection.
function applyLabelPositions(
  nodes: GraphNode[],
  sel: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown>,
): void {
  sel.select<SVGTextElement>("text").each(function (d) {
    const { dx, dy, anchor } = computeLabelOffset(d, nodes);
    const t = d3.select(this);
    t.attr("text-anchor", anchor).attr("x", dx).attr("y", dy);
    t.selectAll("tspan").attr("x", dx);
  });
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

function getThemeColor(varName: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
}

export const GraphView = forwardRef<GraphViewHandle, GraphViewProps>(function GraphView(
  { entities, onSelect, onDeselect, selectedEntityId, onFitAll, highlightedIds, staleRefIds, errorIds }: GraphViewProps,
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const initializedRef = useRef(false);
  const sizeRef = useRef({ width: 800, height: 600 });
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const prevEntityIdsRef = useRef<Set<string>>(new Set());
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const focusBlurRef = useRef<HTMLDivElement>(null);
  const repositionSpotlightRef = useRef<(() => void) | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onFitAllRef = useRef(onFitAll);
  onFitAllRef.current = onFitAll;
  const onDeselectRef = useRef(onDeselect);
  onDeselectRef.current = onDeselect;
  const selectedEntityIdRef = useRef<string | null>(null);
  selectedEntityIdRef.current = selectedEntityId ?? null;

  // Zoom to fit all known node positions into the viewport with padding.
  // Used both for the centering button and automatically after each baked
  // entity update, so the entire visible graph always stays in frame.
  const fitAll = useCallback(() => {
    const svgEl = svgRef.current;
    const zoom = zoomRef.current;
    if (!svgEl || !zoom) return;

    const positions = Array.from(nodePositionsRef.current.values());
    if (positions.length === 0) return;

    /* v8 ignore next 27 -- fitAll animation requires simulation-computed positions; nodePositionsRef is empty with d3-timer mocked */
    const { width, height } = sizeRef.current;
    const padding = 60;
    const xs = positions.map((p) => p.x);
    const ys = positions.map((p) => p.y);
    const minX = Math.min(...xs) - padding;
    const maxX = Math.max(...xs) + padding;
    const minY = Math.min(...ys) - padding;
    const maxY = Math.max(...ys) + padding;

    const contentCx = (minX + maxX) / 2;
    const contentCy = (minY + maxY) / 2;
    const scale = Math.min(width / (maxX - minX), height / (maxY - minY), 2);

    // d3.zoomIdentity.translate(tx,ty).scale(s) produces {k:s, x:tx, y:ty}.
    // SVG transform is translate(tx,ty) scale(s), so content point cx maps to
    // screen position cx*s + tx. To place contentC at viewport center:
    //   contentC * s + tx = viewport/2  →  tx = viewport/2 - contentC * s
    const tx = width / 2 - contentCx * scale;
    const ty = height / 2 - contentCy * scale;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    d3.select(svgEl)
      .transition()
      .duration(reducedMotion ? 0 : 800)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform as never, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }, []);

  const zoomToNode = useCallback((id: string) => {
    const pos = nodePositionsRef.current.get(id);
    if (!pos || !svgRef.current || !zoomRef.current) return;
    /* v8 ignore next 10 -- zoom animation requires simulation-computed positions, unavailable with d3-timer mocked */
    const { width, height } = sizeRef.current;
    const currentScale = d3.zoomTransform(svgRef.current).k;
    // Zoom to at least 1.5× so labels and nearby nodes are clearly readable.
    // If already zoomed in further, stay there.
    const targetScale = Math.max(currentScale, 1.5);
    const tx = width / 2 - pos.x * targetScale;
    const ty = height / 2 - pos.y * targetScale;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    d3.select(svgRef.current)
      .transition()
      .duration(reducedMotion ? 0 : 600)
      .ease(d3.easeCubicInOut)
      .call(zoomRef.current.transform as never, d3.zoomIdentity.translate(tx, ty).scale(targetScale));
  }, []);

  useImperativeHandle(ref, () => ({
    fitAll() {
      fitAll();
      onFitAllRef.current?.();
    },
    zoomToNode(id: string) {
      zoomToNode(id);
    },
  }), [fitAll, zoomToNode]);

  const redrawSelectionRingRef = useRef<(() => void) | null>(null);

  const updateLabelColors = useCallback(() => {
    const g = gRef.current;
    if (!g) return;
    const labelColor = getThemeColor("--text-secondary", "#8FA3B8");
    const bgColor = getThemeColor("--surface-0", "#0f1923");
    g.select(".nodes").selectAll<SVGTextElement, GraphNode>("text")
      .attr("fill", labelColor)
      .attr("stroke", bgColor);
    // Re-draw selection ring so its colors reflect the new theme
    redrawSelectionRingRef.current?.();
  }, []);

  useEffect(() => {
    if (!svgRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const svg = d3.select(svgRef.current);
    const { width, height } = sizeRef.current;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    svg.append("defs");

    const g = svg.append("g");
    gRef.current = g;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      /* v8 ignore next 4 -- zoom event handler requires interactive pan/zoom gestures, not available in jsdom */
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", event.transform.toString());
        repositionSpotlightRef.current?.();
      });

    zoomRef.current = zoom;
    svg.call(zoom as never);

    // Click on empty graph space clears selection
    svg.on("click", () => onDeselectRef.current?.());

    g.append("g").attr("class", "links");
    g.append("g").attr("class", "nodes");

    // The repositioner reads refs directly so it's defined once and always current.
    // It updates the CSS mask-image on the focus-blur overlay div, punching a
    // transparent "eye" at the selected node's screen-space position so that
    // area stays sharp while the backdrop-filter blurs everything outside it.
    repositionSpotlightRef.current = () => {
      const el = focusBlurRef.current;
      const selId = selectedEntityIdRef.current;
      const pos = selId ? nodePositionsRef.current.get(selId) : null;
      if (!pos || !svgRef.current || !el) return;
      /* v8 ignore next 6 -- focus-blur gradient requires simulation-computed positions + zoom transform, unavailable in jsdom */
      const t = d3.zoomTransform(svgRef.current);
      const sx = pos.x * t.k + t.x;
      const sy = pos.y * t.k + t.y;
      const grad = `radial-gradient(circle at ${sx}px ${sy}px, transparent 0px, transparent 130px, black 230px)`;
      el.style.maskImage = grad;
      el.style.webkitMaskImage = grad;
    };
  }, []);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    /* v8 ignore next 8 -- ResizeObserver callback requires real layout; polyfilled as no-op in tests */
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          sizeRef.current = { width, height };
          d3.select(svgEl).attr("viewBox", `0 0 ${width} ${height}`);
        }
      }
    });

    observer.observe(svgEl);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = focusBlurRef.current;
    if (!el) return;
    if (selectedEntityId) {
      repositionSpotlightRef.current?.();
      el.style.opacity = "1";
    } else {
      el.style.opacity = "0";
    }
  }, [selectedEntityId]);

  useEffect(() => {
    const observer = new MutationObserver(() => updateLabelColors());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [updateLabelColors]);

  useEffect(() => {
    const g = gRef.current;
    if (!g || !svgRef.current) return;

    const { width, height } = sizeRef.current;
    const { nodes: newNodes, links: newLinks } = deriveGraphData(entities);
    const cx = width / 2;
    const cy = height / 2;
    const random = mulberry32(42);

    const prevIds = prevEntityIdsRef.current;
    const isInitialLoad = prevIds.size === 0;
    const addedIds = isInitialLoad
      ? []
      : newNodes.filter((n) => !prevIds.has(n.id)).map((n) => n.id);
    prevEntityIdsRef.current = new Set(newNodes.map((n) => n.id));

    for (const n of newNodes) {
      if (n.label === "App") {
        n.x = cx;
        n.y = cy;
        n.fx = cx;
        n.fy = cy;
      } else {
        const saved = nodePositionsRef.current.get(n.id);
        /* v8 ignore next 3 -- position restore requires D3 simulation tick (RAF-driven, mocked in tests) */
        if (saved) {
          n.x = saved.x;
          n.y = saved.y;
        } else {
          n.x = cx + (random() - 0.5) * 20;
          n.y = cy + (random() - 0.5) * 20;
        }
      }
    }

    const simulation = d3
      .forceSimulation<GraphNode>(newNodes)
      .randomSource(d3.randomLcg(42))
      .force(
        "link",
        d3.forceLink<GraphNode, GraphLink>(newLinks).id((d) => d.id).distance(180),
      )
      .force("charge", d3.forceManyBody().strength(-1200))
      .force("x", d3.forceX(cx).strength(0.1))
      .force("y", d3.forceY(cy).strength(0.1))
      .force("collide", d3.forceCollide().radius(40))
      .alphaDecay(0.012)
      .alphaMin(0.001)
      .velocityDecay(0.6);

    if (!isInitialLoad) {
      // Baked path: pre-tick to convergence synchronously, then render once
      simulation.stop();
      const tickCount = Math.ceil(
        Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()),
      );
      simulation.tick(tickCount);
      for (const n of simulation.nodes()) {
        if (n.x != null && n.y != null) {
          nodePositionsRef.current.set(n.id, { x: n.x, y: n.y });
        }
      }
    }

    simulationRef.current = simulation;

    const linkSelection = g
      .select<SVGGElement>(".links")
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(newLinks, (d) => d.id);

    linkSelection.exit().remove();

    const allLinks = linkSelection
      .enter()
      .append("line")
      .attr("stroke-width", 1.5)
      .attr("stroke", (d) => linkStroke(d.type).color)
      .attr("stroke-dasharray", (d) => linkStroke(d.type).dash)
      .merge(linkSelection);

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

      const textEl = el.append("text")
        .attr("text-anchor", "middle")
        .attr("x", 0)
        .attr("y", nodeRadius(d.label) + 16)
        .attr("font-size", "11px")
        .attr("fill", getThemeColor("--text-secondary", "#8FA3B8"))
        .attr("stroke", getThemeColor("--surface-0", "#0f1923"))
        .attr("stroke-width", 3)
        .attr("stroke-linejoin", "round")
        .attr("paint-order", "stroke")
        .attr("pointer-events", "none");

      splitLabel(d.displayName).forEach((line, i) => {
        textEl.append("tspan")
          .attr("x", 0)
          .attr("dy", i === 0 ? 0 : "1.2em")
          .text(line);
      });
    });

    const allNodes = nodeEnter.merge(nodeSelection);

    allNodes.on("click", (event, d) => {
      event.stopPropagation();
      onSelectRef.current(d.id);
      zoomToNode(d.id);
    });

    let panTimeoutId: ReturnType<typeof setTimeout> | null = null;

    if (isInitialLoad) {
      // Animated path: RAF simulation drives DOM; save positions each tick
      /* v8 ignore next 14 -- tick callback is RAF-driven; d3-timer is mocked in tests so it never fires */
      simulation.on("tick", () => {
        allLinks
          .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
          .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
          .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
          .attr("y2", (d) => (d.target as GraphNode).y ?? 0);
        allNodes.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
        for (const n of simulation.nodes()) {
          if (n.x != null && n.y != null) {
            nodePositionsRef.current.set(n.id, { x: n.x, y: n.y });
          }
        }
        applyLabelPositions(simulation.nodes(), allNodes);
      });
    } else {
      // Baked path: render pre-computed positions once
      allLinks
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);
      allNodes.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      applyLabelPositions(simulation.nodes(), allNodes);

      if (addedIds.length > 0) {
        panTimeoutId = setTimeout(() => fitAll(), 50);
      }
    }

    return () => {
      simulation.stop();
      if (panTimeoutId !== null) clearTimeout(panTimeoutId);
    };
  }, [entities]);

  useEffect(() => {
    const g = gRef.current;
    if (!g) return;

    const allNodes = g
      .select<SVGGElement>(".nodes")
      .selectAll<SVGGElement, GraphNode>("g.node-group");

    allNodes.select(".gap-highlight").remove();
    allNodes.select(".error-ring").remove();
    allNodes.select(".stale-ref-badge").remove();
    allNodes.select(".stale-ref-badge-text").remove();

    if (errorIds && errorIds.size > 0) {
      allNodes
        .filter((d) => errorIds.has(d.id))
        .append("circle")
        .attr("class", "error-ring")
        .attr("r", (d) => nodeRadius(d.label) + 6)
        .attr("fill", "none")
        .attr("stroke", "#e74c3c")
        .attr("stroke-width", 2.5)
        .attr("opacity", 0.9);
    }

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
  }, [highlightedIds, staleRefIds, errorIds]);

  // Selection ring + z-order: append a highlight ring to the selected node
  // and raise its group to the top of the SVG stack.
  // The draw function is also stored in a ref so theme changes can re-invoke it.
  useEffect(() => {
    const draw = () => {
      const g = gRef.current;
    if (!g) return;

    const allNodes = g
      .select<SVGGElement>(".nodes")
      .selectAll<SVGGElement, GraphNode>("g.node-group");

    allNodes.selectAll(".selection-ring").remove();

    if (!selectedEntityId) return;

    const target = allNodes.filter((d) => d.id === selectedEntityId);
    if (target.empty()) return;

    // Read theme-aware colors so the ring is legible on both dark and light backgrounds.
    // The separation ring (surface-0 color) carves a gap between node and ring.
    // The accent ring uses the primary color, which has contrast on both themes.
    const sepColor = getThemeColor("--surface-0", "#0f1923");
    const ringColor = getThemeColor("--color-primary", "#4e8ef7");

    // Separation gap — background color, punches visual space between node and ring
    target
      .append("circle")
      .attr("class", "selection-ring")
      .attr("r", (d) => nodeRadius(d.label) + 5)
      .attr("fill", "none")
      .attr("stroke", sepColor)
      .attr("stroke-width", 3)
      .attr("pointer-events", "none");

    // Outer soft glow
    target
      .append("circle")
      .attr("class", "selection-ring")
      .attr("r", (d) => nodeRadius(d.label) + 11)
      .attr("fill", "none")
      .attr("stroke", ringColor)
      .attr("stroke-width", 5)
      .attr("opacity", 0.3)
      .attr("pointer-events", "none");

    // Crisp accent ring
    target
      .append("circle")
      .attr("class", "selection-ring")
      .attr("r", (d) => nodeRadius(d.label) + 8)
      .attr("fill", "none")
      .attr("stroke", ringColor)
      .attr("stroke-width", 2)
      .attr("pointer-events", "none");

    // Bring the selected node group to the front of the SVG paint order
    target.raise();
    };

    redrawSelectionRingRef.current = draw;
    draw();
  }, [selectedEntityId]);

  return (
    <div className="graph-container">
      <svg
        ref={svgRef as React.RefObject<SVGSVGElement>}
        data-testid="graph-view"
        className="graph-svg"
      />
      <div ref={focusBlurRef} className="focus-blur-overlay" />
      <button
        className="graph-center-btn"
        onClick={() => { fitAll(); onFitAllRef.current?.(); }}
        title="Fit graph to view"
        aria-label="Fit graph to view"
      >
        ⊙
      </button>
    </div>
  );
});
