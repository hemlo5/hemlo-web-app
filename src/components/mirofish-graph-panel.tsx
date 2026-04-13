"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface GraphNode {
  uuid: string;
  name: string;
  labels?: string[];
  attributes?: Record<string, any>;
  summary?: string;
  created_at?: string;
}
interface GraphEdge {
  uuid: string;
  source_node_uuid: string;
  target_node_uuid: string;
  name?: string;
  fact_type?: string;
  fact?: string;
  episodes?: string[];
  created_at?: string;
}
interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Exact color palette from GraphPanel.vue
const COLORS = ["#FF6B35", "#004E89", "#7B2D8E", "#1A936F", "#C5283D", "#E9724C", "#3498db", "#9b59b6", "#27ae60", "#f39c12"];

export function MirofishGraphPanel({
  projectId,
  isSimulating,
  liveData,
  liveEvent,
}: {
  projectId: string | null;
  isSimulating: boolean;
  liveData?: { nodes: any[]; edges: any[] } | null;
  liveEvent?: any | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const colorMapRef = useRef<Record<string, string>>({});
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [d3Error, setD3Error] = useState<string | null>(null);
  const [entityTypes, setEntityTypes] = useState<{ name: string; color: string; count: number }[]>([]);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const linkLabelsRef = useRef<any>(null);
  const linkLabelBgRef = useRef<any>(null);

  const fetchGraph = useCallback(async () => {
    // RULE: When isSimulating=true, we ONLY use SSE liveData — never localhost.
    // localhost is only for viewing completed simulations post-run.
    if (isSimulating) return;

    // If liveData is injected from SSE, use it immediately.
    if (liveData && liveData.nodes && liveData.edges) {
      setGraphData({ nodes: liveData.nodes, edges: liveData.edges });
      setStatus("live");
      return;
    }

    if (!projectId) return;
    setStatus("loading");
    try {
      const proj = await fetch(`http://localhost:5001/api/graph/project/${projectId}`).then(r => r.json());
      const graphId = proj.data?.graph_id;
      if (!graphId) return;
      const gd = await fetch(`http://localhost:5001/api/graph/data/${graphId}`).then(r => r.json());
      if (gd.data?.nodes) {
        setGraphData({ nodes: gd.data.nodes || [], edges: gd.data.edges || [] });
        setStatus("live");
      }
    } catch {
      setStatus("error");
    }
  }, [projectId, liveData, isSimulating]);

  useEffect(() => {
    // Handle live SSE data — always takes priority
    if (liveData && liveData.nodes && liveData.edges) {
      setStatus("live");
      setGraphData({ nodes: liveData.nodes, edges: liveData.edges });
      return;
    }

    // SSE simulation mode: show waiting state until graph_build event fires
    if (isSimulating) {
      setStatus("idle");
      return;
    }

    // Historical view mode: poll localhost for completed simulation data
    if (!projectId) return;
    fetchGraph();
    return () => {};
  }, [projectId, isSimulating, fetchGraph, liveData]);

  // Build entity type color map (same logic as GraphPanel.vue computed entityTypes)
  const buildColorMap = useCallback((nodes: GraphNode[]) => {
    const typeMap: Record<string, { name: string; count: number; color: string }> = {};
    nodes.forEach(node => {
      const type = node.labels?.find(l => l !== "Entity") || "Entity";
      if (!typeMap[type]) {
        typeMap[type] = { name: type, count: 0, color: COLORS[Object.keys(typeMap).length % COLORS.length] };
      }
      typeMap[type].count++;
    });
    return Object.values(typeMap);
  }, []);

  // Exact renderGraph port from GraphPanel.vue (upgraded to dynamic join)
  const renderGraph = useCallback(() => {
    try {
      if (!svgRef.current || !containerRef.current || !graphData) return;

      const types = buildColorMap(graphData.nodes);
      setEntityTypes(types);
      const colorMap: Record<string, string> = {};
      types.forEach(t => colorMap[t.name] = t.color);
      colorMapRef.current = colorMap;
      const getColor = (type: string) => colorMap[type] || "#999";

      const container = containerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight || 400;

      const svg = d3.select(svgRef.current)
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`);

    // DYNAMIC GRAPH ARCHITECTURE: Only init wrappers once
    if (svg.select(".main-g").empty()) {
      const g = svg.append("g").attr("class", "main-g");
      g.append("g").attr("class", "links");
      g.append("g").attr("class", "nodes");
      
      // Zoom
      svg.call(
        d3.zoom<SVGSVGElement, unknown>()
          .extent([[0, 0], [width, height]])
          .scaleExtent([0.1, 4])
          .on("zoom", (event) => { g.attr("transform", event.transform); })
      );
    }
    
    const g = svg.select(".main-g");

    const nodesData = graphData.nodes;
    const edgesData = graphData.edges;
    if (nodesData.length === 0) return;

    const nodeMap: Record<string, GraphNode> = {};
    nodesData.forEach(n => nodeMap[n.uuid] = n);

    const nodes: any[] = nodesData.map(n => ({
      id: n.uuid,
      name: n.name || "Unnamed",
      type: n.labels?.find(l => l !== "Entity") || "Entity",
      rawData: n,
    }));

    const nodeIds = new Set(nodes.map(n => n.id));

    // Process edges
    const edgePairCount: Record<string, number> = {};
    const selfLoopEdges: Record<string, any[]> = {};
    const tempEdges = edgesData.filter(e => nodeIds.has(e.source_node_uuid) && nodeIds.has(e.target_node_uuid));

    tempEdges.forEach(e => {
      if (e.source_node_uuid === e.target_node_uuid) {
        if (!selfLoopEdges[e.source_node_uuid]) selfLoopEdges[e.source_node_uuid] = [];
        selfLoopEdges[e.source_node_uuid].push({
          ...e,
          source_name: nodeMap[e.source_node_uuid]?.name,
          target_name: nodeMap[e.target_node_uuid]?.name,
        });
      } else {
        const pairKey = [e.source_node_uuid, e.target_node_uuid].sort().join("_");
        edgePairCount[pairKey] = (edgePairCount[pairKey] || 0) + 1;
      }
    });

    const edgePairIndex: Record<string, number> = {};
    const processedSelfLoopNodes = new Set<string>();
    const edges: any[] = [];

    tempEdges.forEach(e => {
      const isSelfLoop = e.source_node_uuid === e.target_node_uuid;
      if (isSelfLoop) {
        if (processedSelfLoopNodes.has(e.source_node_uuid)) return;
        processedSelfLoopNodes.add(e.source_node_uuid);
        const allSelfLoops = selfLoopEdges[e.source_node_uuid];
        const nodeName = nodeMap[e.source_node_uuid]?.name || "Unknown";
        edges.push({
          id: `sl_${e.source_node_uuid}`,
          source: e.source_node_uuid, target: e.target_node_uuid,
          type: "SELF_LOOP", name: `Self Relations (${allSelfLoops.length})`,
          curvature: 0, isSelfLoop: true,
          rawData: { isSelfLoopGroup: true, source_name: nodeName, target_name: nodeName, selfLoopCount: allSelfLoops.length, selfLoopEdges: allSelfLoops },
        });
        return;
      }
      const pairKey = [e.source_node_uuid, e.target_node_uuid].sort().join("_");
      const totalCount = edgePairCount[pairKey];
      const currentIndex = edgePairIndex[pairKey] || 0;
      edgePairIndex[pairKey] = currentIndex + 1;
      const isReversed = e.source_node_uuid > e.target_node_uuid;
      let curvature = 0;
      if (totalCount > 1) {
        const curvatureRange = Math.min(1.2, 0.6 + totalCount * 0.15);
        curvature = ((currentIndex / (totalCount - 1)) - 0.5) * curvatureRange * 2;
        if (isReversed) curvature = -curvature;
      }
      edges.push({
        id: e.uuid || `${e.source_node_uuid}_${e.target_node_uuid}_${currentIndex}`,
        source: e.source_node_uuid, target: e.target_node_uuid,
        type: e.fact_type || e.name || "RELATED", name: e.name || e.fact_type || "RELATED",
        curvature, isSelfLoop: false, pairIndex: currentIndex, pairTotal: totalCount,
        rawData: { ...e, source_name: nodeMap[e.source_node_uuid]?.name, target_name: nodeMap[e.target_node_uuid]?.name },
      });
    });

    // Determine if simulation is initialising
    let simulation = simulationRef.current;
    if (!simulation) {
      simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id((d: any) => d.id).distance((d: any) => {
          const baseDistance = 150;
          return baseDistance + ((d.pairTotal || 1) - 1) * 50;
        }))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide(50))
        .force("x", d3.forceX(width / 2).strength(0.04))
        .force("y", d3.forceY(height / 2).strength(0.04));
      simulationRef.current = simulation;
    }

    // Retain existing positions
    const oldNodes = simulation.nodes() as any[];
    const oldNodeMap = new Map(oldNodes.map(n => [n.id, n]));
    nodes.forEach(n => {
      const old = oldNodeMap.get(n.id);
      if (old) { n.x = old.x; n.y = old.y; n.vx = old.vx; n.vy = old.vy; }
      else { n.x = width/2 + (Math.random() - 0.5)*50; n.y = height/2 + (Math.random() - 0.5)*50; }
    });

    simulation.nodes(nodes);
    (simulation.force("link") as any).links(edges);

    // Path helpers
    const getLinkPath = (d: any) => {
      const sx = d.source.x || 0, sy = d.source.y || 0;
      const tx = d.target.x || 0, ty = d.target.y || 0;
      if (d.isSelfLoop) {
        const loopRadius = 30;
        return `M${sx + 8},${sy - 4} A${loopRadius},${loopRadius} 0 1,1 ${sx + 8},${sy + 4}`;
      }
      if (d.curvature === 0) return `M${sx},${sy} L${tx},${ty}`;
      const dx = tx - sx, dy = ty - sy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const pairTotal = d.pairTotal || 1;
      const offsetRatio = 0.25 + pairTotal * 0.05;
      const baseOffset = Math.max(35, dist * offsetRatio);
      const offsetX = -dy / dist * d.curvature * baseOffset;
      const offsetY = dx / dist * d.curvature * baseOffset;
      const cx = (sx + tx) / 2 + offsetX, cy = (sy + ty) / 2 + offsetY;
      return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
    };

    const getLinkMidpoint = (d: any) => {
      const sx = d.source.x || 0, sy = d.source.y || 0, tx = d.target.x || 0, ty = d.target.y || 0;
      if (d.isSelfLoop) return { x: sx + 70, y: sy };
      if (d.curvature === 0) return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
      const dx = tx - sx, dy = ty - sy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const pairTotal = d.pairTotal || 1;
      const offsetRatio = 0.25 + pairTotal * 0.05;
      const baseOffset = Math.max(35, dist * offsetRatio);
      const offsetX = -dy / dist * d.curvature * baseOffset;
      const offsetY = dx / dist * d.curvature * baseOffset;
      const cx = (sx + tx) / 2 + offsetX, cy = (sy + ty) / 2 + offsetY;
      return { x: 0.25 * sx + 0.5 * cx + 0.25 * tx, y: 0.25 * sy + 0.5 * cy + 0.25 * ty };
    };

    // LINKS JOIN
    const linkGroup = g.select(".links");
    let link = linkGroup.selectAll<SVGPathElement, any>("path").data(edges, (d:any) => d.id);
    
    link = link.join(
      enter => enter.append("path")
        .attr("stroke", "#C0C0C0").attr("stroke-width", 1.5).attr("fill", "none")
        .style("cursor", "pointer")
        .on("click", function (event, d) {
          event.stopPropagation();
          linkGroup.selectAll("path").attr("stroke", "#C0C0C0").attr("stroke-width", 1.5);
          linkLabelBg.attr("fill", "rgba(255,255,255,0.95)");
          linkLabels.attr("fill", "#666");
          d3.select(this).attr("stroke", "#3498db").attr("stroke-width", 3);
          setSelectedItem({ type: "edge", data: d.rawData });
        }),
      update => update,
      exit => exit.remove()
    );

    let linkLabelBg = linkGroup.selectAll<SVGRectElement, any>("rect").data(edges, (d:any) => d.id);
    linkLabelBg = linkLabelBg.join(
      enter => enter.append("rect")
        .attr("fill", "rgba(255,255,255,0.95)").attr("rx", 3).attr("ry", 3)
        .style("cursor", "pointer").style("pointer-events", "all")
        .style("display", showEdgeLabels ? "block" : "none")
        .on("click", function (event, d) {
          event.stopPropagation();
          linkGroup.selectAll("path").attr("stroke", "#C0C0C0").attr("stroke-width", 1.5);
          linkLabelBg.attr("fill", "rgba(255,255,255,0.95)");
          linkLabels.attr("fill", "#666");
          link.filter((l: any) => l.id === d.id).attr("stroke", "#3498db").attr("stroke-width", 3);
          d3.select(this).attr("fill", "rgba(52,152,219,0.1)");
          setSelectedItem({ type: "edge", data: d.rawData });
        }),
      update => update,
      exit => exit.remove()
    );

    let linkLabels = linkGroup.selectAll<SVGTextElement, any>("text").data(edges, (d:any) => d.id);
    linkLabels = linkLabels.join(
      enter => enter.append("text")
        .text((d: any) => d.name)
        .attr("font-size", "9px").attr("fill", "#666")
        .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .style("cursor", "pointer").style("pointer-events", "all")
        .style("font-family", "system-ui, sans-serif")
        .style("display", showEdgeLabels ? "block" : "none"),
      update => update.text((d: any) => d.name),
      exit => exit.remove()
    );

    linkLabelsRef.current = linkLabels;
    linkLabelBgRef.current = linkLabelBg;

    // NODES JOIN
    const nodeGroup = g.select(".nodes");
    
    let node = nodeGroup.selectAll<SVGCircleElement, any>("circle").data(nodes, (d:any) => d.id);
    node = node.join(
      enter => enter.append("circle")
        .attr("r", 10)
        .attr("fill", (d: any) => getColor(d.type))
        .attr("stroke", "#fff").attr("stroke-width", 2.5)
        .style("cursor", "pointer")
        .call(
          d3.drag<SVGCircleElement, any>()
            .on("start", function (event, d) {
              d.fx = d.x; d.fy = d.y;
              d._dragStartX = event.x; d._dragStartY = event.y;
              d._isDragging = false;
            })
            .on("drag", function (event, d) {
              const dx = event.x - d._dragStartX, dy = event.y - d._dragStartY;
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (!d._isDragging && distance > 3) { d._isDragging = true; simulation!.alphaTarget(0.3).restart(); }
              if (d._isDragging) { d.fx = event.x; d.fy = event.y; }
            })
            .on("end", function (_event, d) {
              if (d._isDragging) simulation!.alphaTarget(0);
              d.fx = null; d.fy = null; d._isDragging = false;
            })
        )
        .on("click", function (event, d) {
          event.stopPropagation();
          node.attr("stroke", "#fff").attr("stroke-width", 2.5);
          linkGroup.selectAll("path").attr("stroke", "#C0C0C0").attr("stroke-width", 1.5);
          d3.select(this).attr("stroke", "#E91E63").attr("stroke-width", 4);
          link.filter((l: any) => l.source.id === d.id || l.target.id === d.id)
            .attr("stroke", "#E91E63").attr("stroke-width", 2.5);
          setSelectedItem({ type: "node", data: d.rawData, entityType: d.type, color: getColor(d.type) });
        })
        .on("mouseenter", function (event, d) {
          if (!selectedItem || (selectedItem as any).data?.uuid !== d.rawData.uuid) {
            d3.select(this).attr("stroke", "#333").attr("stroke-width", 3);
          }
        })
        .on("mouseleave", function (event, d) {
          if (!selectedItem || (selectedItem as any).data?.uuid !== d.rawData.uuid) {
            d3.select(this).attr("stroke", "#fff").attr("stroke-width", 2.5);
          }
        }),
      update => update,
      exit => exit.remove()
    );

    let nodeLabels = nodeGroup.selectAll<SVGTextElement, any>("text").data(nodes, (d:any) => d.id);
    nodeLabels = nodeLabels.join(
      enter => enter.append("text")
        .text((d: any) => d.name.length > 8 ? d.name.substring(0, 8) + "…" : d.name)
        .attr("font-size", "11px").attr("fill", "#333").attr("font-weight", "500")
        .attr("dx", 14).attr("dy", 4)
        .style("pointer-events", "none")
        .style("font-family", "system-ui, sans-serif"),
      update => update.text((d: any) => d.name.length > 8 ? d.name.substring(0, 8) + "…" : d.name),
      exit => exit.remove()
    );

    // Tick — dynamically binding
    simulation.on("tick", () => {
      link.attr("d", (d: any) => getLinkPath(d));
      linkLabels.each(function (d: any) {
        const mid = getLinkMidpoint(d);
        d3.select(this).attr("x", mid.x).attr("y", mid.y).attr("transform", "");
      });
      linkLabelBg.each(function (d: any, i: number) {
        const mid = getLinkMidpoint(d);
        const textEl = (linkLabels.nodes() as SVGTextElement[])[i];
        if (!textEl) return;
        try {
          const bbox = textEl.getBBox();
          d3.select(this)
            .attr("x", mid.x - bbox.width / 2 - 4).attr("y", mid.y - bbox.height / 2 - 2)
            .attr("width", bbox.width + 8).attr("height", bbox.height + 4).attr("transform", "");
        } catch { } // Catch SSR/measuring bugs
      });
      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      nodeLabels.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });
    
    simulation.alpha(0.3).restart();

    // Click on empty to deselect
    svg.on("click", () => {
      setSelectedItem(null);
      node.attr("stroke", "#fff").attr("stroke-width", 2.5);
      linkGroup.selectAll("path").attr("stroke", "#C0C0C0").attr("stroke-width", 1.5);
      linkLabelBg.attr("fill", "rgba(255,255,255,0.95)");
      linkLabels.attr("fill", "#666");
    });
    setD3Error(null);
    } catch (e: any) {
      console.error("D3 Rendering Error:", e);
      setD3Error(e.message || String(e));
    }
  }, [graphData, buildColorMap, showEdgeLabels, selectedItem]);

  // Handle transient liveEvents (Graph mutations like highlighted thoughts) without structural D3 re-draws
  useEffect(() => {
    if (!liveEvent || !svgRef.current) return;
    if (liveEvent.type === "highlight_node" && liveEvent.agent) {
      const svg = d3.select(svgRef.current);
      // Flash node size and color
      const tNode = svg.select(".nodes").selectAll("circle")
        .filter((d: any) => d.name === liveEvent.agent || d.name === `Thought: ${liveEvent.agent.substring(0, 6)}`);
      
      tNode.transition().duration(200)
        .attr("r", 18)
        .attr("fill", "#22c55e")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 4)
        .transition().duration(1200)
        .attr("r", 10)
        .attr("fill", (d: any) => colorMapRef.current[d.type] || "#999")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2.5);
    }
  }, [liveEvent]);

  // Re-render when graphData changes
  useEffect(() => {
    renderGraph();
  }, [renderGraph]);

  // Toggle edge labels reactively — same as GraphPanel.vue
  useEffect(() => {
    if (linkLabelsRef.current) linkLabelsRef.current.style("display", showEdgeLabels ? "block" : "none");
    if (linkLabelBgRef.current) linkLabelBgRef.current.style("display", showEdgeLabels ? "block" : "none");
  }, [showEdgeLabels]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => renderGraph();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderGraph]);

  // Cleanup simulation on unmount
  useEffect(() => () => { simulationRef.current?.stop(); }, []);

  return (
    <div style={{
      position: "relative", width: "100%", height: 520,
      // Exact MiroFish styling: white dotted-grid background
      backgroundColor: "#FAFAFA",
      backgroundImage: "radial-gradient(#D0D0D0 1.5px, transparent 1.5px)",
      backgroundSize: "24px 24px",
      overflow: "hidden",
    }}>
      {/* Panel header — matches MiroFish exactly */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "16px 20px", zIndex: 10,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(255,255,255,0))",
        pointerEvents: "none",
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#333", pointerEvents: "auto" }}>
          Graph Relationship Visualization
        </span>
        <div style={{ pointerEvents: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {status === "loading" && !liveData && (
            <span style={{ fontSize: 12, color: "#999" }}>Loading...</span>
          )}
          {status === "error" && !liveData && (
            <span style={{ fontSize: 12, color: "#e74c3c" }}>Connection error</span>
          )}
          {!projectId && !liveData && (
            <span style={{ fontSize: 12, color: "#bbb" }}>Waiting for simulation...</span>
          )}
          {!liveData && (
            <button
              onClick={fetchGraph}
              disabled={!projectId || status === "loading"}
              style={{
                height: 32, padding: "0 12px", border: "1px solid #E0E0E0", background: "#FFF",
                borderRadius: 6, display: "flex", alignItems: "center", gap: 6,
                cursor: "pointer", color: "#666", fontSize: 13,
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              }}
            >
              <span style={{ fontSize: 14 }}>↻</span>
              <span style={{ fontSize: 12 }}>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Graph container */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
        <svg ref={svgRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>

      {/* "Updating in real time..." pill — exact match to MiroFish */}
      {isSimulating && graphData && !d3Error && (
        <div style={{
          position: "absolute", bottom: 160, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
          color: "#fff", padding: "10px 20px", borderRadius: 30, fontSize: 13,
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.1)",
          fontWeight: 500, letterSpacing: 0.5, zIndex: 100,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" width={18} height={18} style={{ animation: "breathe 2s ease-in-out infinite" }}>
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-4.04z" />
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-4.04z" />
          </svg>
          Updating in real time...
        </div>
      )}

      {/* D3 Crash Error State */}
      {d3Error && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(255,255,255,0.9)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <div style={{ color: "#E91E63", fontSize: 24, marginBottom: 8, fontWeight: 700 }}>D3 Graph Error</div>
          <div style={{ fontFamily: "monospace", backgroundColor: "#fbeff2", padding: 12, borderRadius: 8, color: "#900", maxWidth: 400, wordBreak: "break-all" }}>{d3Error}</div>
        </div>
      )}

      {/* Empty / waiting state */}
      {(!graphData || graphData.nodes.length === 0) && !d3Error && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", color: "#999", pointerEvents: "none" }}>
          {isSimulating && !liveData ? (
            // SSE waiting state — show pulsing animation, not an error
            <>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: "#7B2D8E",
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#555" }}>Waiting for graph build from Modal engine…</p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#aaa" }}>Graph will appear once the ontology step completes</p>
              <style>{`@keyframes pulse { 0%,100%{transform:scale(0.6);opacity:0.3} 50%{transform:scale(1.2);opacity:1} }`}</style>
            </>
          ) : status === "loading" ? (
            <>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>❖</div>
              <p style={{ margin: 0, fontSize: 14 }}>Loading graph data…</p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>❖</div>
              <p style={{ margin: 0, fontSize: 14 }}>{projectId || liveData ? "Building graph..." : "Waiting for ontology generation..."}</p>
            </>
          )}
        </div>
      )}

      {/* Entity Types Legend — bottom left, exact match */}
      {entityTypes.length > 0 && (
        <div style={{
          position: "absolute", bottom: 24, left: 24,
          background: "rgba(255,255,255,0.95)", padding: "12px 16px",
          borderRadius: 8, border: "1px solid #EAEAEA",
          boxShadow: "0 4px 16px rgba(0,0,0,0.06)", zIndex: 10,
        }}>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#E91E63", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            ENTITY TYPES
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px", maxWidth: 320 }}>
            {entityTypes.map(t => (
              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: t.color, flexShrink: 0, display: "inline-block" }} />
                {t.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edge Labels Toggle — top right, exact match */}
      {graphData && (
        <div style={{
          position: "absolute", top: 60, right: 20,
          display: "flex", alignItems: "center", gap: 10,
          background: "#FFF", padding: "8px 14px", borderRadius: 20,
          border: "1px solid #E0E0E0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", zIndex: 10,
        }}>
          <label style={{ position: "relative", display: "inline-block", width: 40, height: 22, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showEdgeLabels}
              onChange={e => setShowEdgeLabels(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
            />
            <span style={{
              position: "absolute", cursor: "pointer", inset: 0,
              backgroundColor: showEdgeLabels ? "#7B2D8E" : "#E0E0E0",
              borderRadius: 22, transition: "0.3s",
            }}>
              <span style={{
                position: "absolute", height: 16, width: 16, left: 3, bottom: 3,
                backgroundColor: "white", borderRadius: "50%", transition: "0.3s",
                transform: showEdgeLabels ? "translateX(18px)" : "translateX(0)",
              }} />
            </span>
          </label>
          <span style={{ fontSize: 12, color: "#666" }}>Show Edge Labels</span>
        </div>
      )}

      {/* Detail panel when a node or edge is selected */}
      {selectedItem && (
        <div style={{
          position: "absolute", top: 60, right: 20, width: 320,
          maxHeight: "calc(100% - 100px)", background: "#FFF",
          border: "1px solid #EAEAEA", borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)", overflow: "hidden",
          fontSize: 13, zIndex: 20, display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#FAFAFA", borderBottom: "1px solid #EEE" }}>
            <span style={{ fontWeight: 600, color: "#333", fontSize: 14 }}>
              {selectedItem.type === "node" ? "Node Details" : "Relationship"}
            </span>
            {selectedItem.type === "node" && (
              <span style={{ padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500, background: selectedItem.color, color: "#fff", marginRight: 12 }}>
                {selectedItem.entityType}
              </span>
            )}
            <button onClick={() => setSelectedItem(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#999", lineHeight: 1, padding: 0 }}>×</button>
          </div>
          <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
            {selectedItem.type === "node" ? (
              <>
                <div style={{ marginBottom: 12 }}><span style={{ color: "#888", fontSize: 12, minWidth: 80, display: "inline-block" }}>Name:</span><span style={{ color: "#333" }}>{selectedItem.data.name}</span></div>
                {selectedItem.data.summary && <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #F0F0F0", fontSize: 12, color: "#444", lineHeight: 1.6 }}>{selectedItem.data.summary}</div>}
                {selectedItem.data.labels?.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #F0F0F0" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 8 }}>Labels:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {selectedItem.data.labels.map((l: string) => (
                        <span key={l} style={{ padding: "4px 12px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 16, fontSize: 11, color: "#555" }}>{l}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ background: "#F8F8F8", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500, color: "#333", lineHeight: 1.5, wordBreak: "break-word" }}>
                  {selectedItem.data.source_name} → {selectedItem.data.name || "RELATED_TO"} → {selectedItem.data.target_name}
                </div>
                {selectedItem.data.fact && <div style={{ fontSize: 12, color: "#444", lineHeight: 1.5 }}>{selectedItem.data.fact}</div>}
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.7; transform: scale(1); filter: drop-shadow(0 0 2px rgba(76,175,80,0.3)); }
          50% { opacity: 1; transform: scale(1.15); filter: drop-shadow(0 0 8px rgba(76,175,80,0.6)); }
        }
      `}</style>
    </div>
  );
}
