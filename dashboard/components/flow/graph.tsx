"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ControlButton, Controls, getViewportForBounds, MarkerType, ReactFlow, type Edge, type Node, type ReactFlowInstance, type Viewport } from "@xyflow/react";
import { Maximize } from "lucide-react";
import { useTheme } from "next-themes";
import { countsFor } from "@/lib/findings";
import { JOIN_STATUS, fmt } from "@/lib/status";
import { findingSummary, markCounts, traceTone, type TraceFindings } from "@/lib/trace-findings";
import type { HopStatus, JoinSide, MapData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GridLayer } from "./grid-layer";
import { StatusEdge, type StatusEdgeType } from "./status-edge";
import { TableNode, type TableNodeType } from "./table-node";

// Invisible corner nodes describe the whole grid, including the space around the tables.
function Anchor() {
  return <div className="size-px" />;
}
const nodeTypes = { table: TableNode, anchor: Anchor };
const edgeTypes = { status: StatusEdge };

// SVG arrow markers need a real colour, not a CSS variable: the same tones as app/globals.css.
const MARKER = {
  light: { ok: "#1a7f50", warn: "#c98a10", bad: "#c0392b", info: "#8a93a5" },
  dark: { ok: "#4cc38a", warn: "#e3ad42", bad: "#ec7466", info: "#98a2b3" },
};

export type Selection = { kind: "node" | "edge"; id: string } | null;
export type TraceHighlight = {
  nodes: Record<string, HopStatus>;
  edges: Record<string, HopStatus>;
  findings: TraceFindings;
};

type Props = {
  data: MapData;
  showLookups: boolean;
  animate: boolean;
  selection?: Selection;
  onSelect?: (selection: Selection) => void;
  trace?: TraceHighlight;
  className?: string;
};

/** Short text for an edge label: what is wrong with its raw keys, if anything. */
export function edgeIssue(edgeId: string, health: JoinSide[]): string {
  const sides = health.filter((h) => h.edgeId === edgeId);
  const unmatched = sides.filter((h) => h.status === "orphans").reduce((n, h) => n + h.orphanKeys, 0);
  if (unmatched) return `${fmt(unmatched)} unmatched`;
  const repeated = Math.max(0, ...sides.filter((h) => h.status === "fan_out").map((h) => h.repeatedKeys));
  if (repeated) return `${fmt(repeated)} repeated`;
  const blank = sides.filter((h) => h.status === "blank_keys").reduce((n, h) => n + h.blankKeyRows, 0);
  return blank ? `${fmt(blank)} blank keys` : "";
}

const subscribeNothing = () => () => {};
const FIT_PADDING = 0.02;
const MAX_ZOOM = 2;

export function Graph({ data, showLookups, animate, selection, onSelect, trace, className }: Props) {
  const { resolvedTheme } = useTheme();
  // The server cannot know the theme: render light first, switch after hydration (no mismatch).
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const markers = MARKER[hydrated && resolvedTheme === "dark" ? "dark" : "light"];

  // Refit whenever the map's box changes size (menu or panel hidden, window resized), not only on first render.
  const box = useRef<HTMLDivElement>(null);
  const flow = useRef<ReactFlowInstance | null>(null);
  const [home, setHome] = useState<Viewport>({ x: 0, y: 0, zoom: 0.01 });
  const [canPan, setCanPan] = useState(false);
  const bounds = useMemo(() => {
    const left = Math.min(...data.offices.map((o) => o.x));
    return {
      x: left, y: 0,
      width: Math.max(...data.offices.map((o) => o.x + o.w)) - left + 1,
      height: Math.max(...data.offices.map((o) => o.y + o.h)) + 25,
    };
  }, [data.offices]);
  // The full grid, including headings and the FX return line, defines both home and the zoom-out limit.
  const resetView = useCallback(() => {
    if (!box.current || !flow.current) return;
    const { width, height } = box.current.getBoundingClientRect();
    if (!width || !height) return;
    const viewport = getViewportForBounds(bounds, width, height, 0.01, MAX_ZOOM, FIT_PADDING);
    setHome(viewport);
    setCanPan(false);
  }, [bounds]);
  // Apply after React Flow receives the new minimum; otherwise a smaller container is clamped by the old limit.
  useEffect(() => { void flow.current?.setViewport(home); }, [home]);
  useEffect(() => {
    if (!box.current) return;
    const observer = new ResizeObserver(resetView);
    observer.observe(box.current);
    return () => observer.disconnect();
  }, [resetView]);

  const nodes = useMemo<Node[]>(() => {
    const right = Math.max(...data.offices.map((o) => o.x + o.w)), bottom = Math.max(...data.offices.map((o) => o.y + o.h));
    const anchors: Node[] = [
      { id: "anchor-top-left", type: "anchor", position: { x: Math.min(...data.offices.map((o) => o.x)), y: 0 }, data: {}, selectable: false, focusable: false },
      // A little room below the last row for lines that dip under it (FX rates → Prices).
      { id: "anchor-bottom-right", type: "anchor", position: { x: right, y: bottom + 24 }, data: {}, selectable: false, focusable: false },
    ];
    return [...anchors, ...data.nodes.map<TableNodeType>((node) => {
      return {
        id: node.id,
        type: "table",
        position: { x: node.x, y: node.y },
        origin: [0, node.originY],
        data: {
          node,
          counts: trace ? markCounts(trace.findings.nodes[node.id] ?? []) : countsFor(data.register, "node", node.id),
          selected: selection?.kind === "node" && selection.id === node.id,
          dimmed: Boolean(trace) && !trace?.nodes[node.id],
          traceStatus: trace?.nodes[node.id],
          traceFindings: trace?.findings.nodes[node.id],
        },
      };
    })];
  }, [data, selection, trace]);

  const edges = useMemo<Edge[]>(() => {
    return data.edges
      .filter((edge) => edge.kind !== "lookup" || showLookups || trace?.edges[edge.id])
      .map<StatusEdgeType>((edge) => {
        const traceStatus = trace?.edges[edge.id];
        const traceFindings = trace?.findings.edges[edge.id] ?? [];
        const tone = traceStatus ? traceTone(traceStatus, traceFindings) : JOIN_STATUS[edge.status].tone;
        return {
          id: edge.id,
          type: "status",
          source: edge.source,
          target: edge.target,
          sourceHandle: `out-${edge.fromHandle}`,
          targetHandle: `in-${edge.toHandle}`,
          animated: trace ? Boolean(traceStatus) : animate && edge.kind !== "lookup",
          markerEnd: { type: MarkerType.ArrowClosed, color: markers[tone], width: 14, height: 14 },
          data: {
            edge,
            issue: trace ? findingSummary(traceFindings)?.label ?? "" : edgeIssue(edge.id, data.health),
            counts: trace ? markCounts(traceFindings) : countsFor(data.register, "edge", edge.id),
            selected: selection?.kind === "edge" && selection.id === edge.id,
            dimmed: Boolean(trace) && !traceStatus,
            inTrace: Boolean(trace),
            traceStatus,
            traceFindings,
            onSelect: onSelect ? (id: string) => onSelect({ kind: "edge", id }) : undefined,
          },
        };
      });
  }, [data, showLookups, animate, selection, trace, markers, onSelect]);

  return (
    <div ref={box} data-map-graph className={cn("h-full w-full", className)}>
      <ReactFlow
        onInit={(instance) => { flow.current = instance; resetView(); }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={home.zoom}
        maxZoom={MAX_ZOOM}
        panOnDrag={canPan}
        onMove={(_, viewport) => setCanPan(viewport.zoom > home.zoom + 0.0001)}
        onMoveEnd={(_, viewport) => {
          // Wheel/pinch zoom can finish off-centre. At the floor always restore the centred home view.
          if (viewport.zoom <= home.zoom + 0.0001 &&
              (Math.abs(viewport.x - home.x) > 0.01 || Math.abs(viewport.y - home.y) > 0.01)) {
            void flow.current?.setViewport(home);
          }
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, node) => node.type === "table" && onSelect?.({ kind: "node", id: node.id })}
        onEdgeClick={(_, edge) => onSelect?.({ kind: "edge", id: edge.id })}
        onPaneClick={() => onSelect?.(null)}
      >
        <GridLayer offices={data.offices} stages={data.stages} />
        <Controls showInteractive={false} showFitView={false} position="top-right">
          <ControlButton onClick={resetView} title="Fit View" aria-label="Fit View"><Maximize /></ControlButton>
        </Controls>
      </ReactFlow>
    </div>
  );
}
