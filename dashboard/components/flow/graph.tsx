"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Background, BackgroundVariant, Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { useTheme } from "next-themes";
import { HOP_STATUS, JOIN_STATUS, fmt } from "@/lib/status";
import type { HopStatus, JoinSide, MapData, MapNode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BandLayer } from "./band-layer";
import { StatusEdge, type StatusEdgeType } from "./status-edge";
import { NODE_HEIGHT, NODE_WIDTH, TableNode, type TableNodeType } from "./table-node";

// Two invisible corner nodes make fitView (and the fit button) frame the office bands, not just the tables.
function Anchor() {
  return <div className="size-px" />;
}
const nodeTypes = { table: TableNode, anchor: Anchor };
const edgeTypes = { status: StatusEdge };

// SVG arrow markers need a real colour, not a CSS variable: the same tones as app/globals.css.
const MARKER = {
  light: { ok: "#2a7f75", warn: "#c98a10", bad: "#c0392b", info: "#7d8797" },
  dark: { ok: "#5cc0b2", warn: "#e3ad42", bad: "#ec7466", info: "#98a2b3" },
};

export type Selection = { kind: "node" | "edge"; id: string } | null;
export type TraceHighlight = { nodes: Record<string, HopStatus>; edges: Record<string, HopStatus> };

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

function handles(source: MapNode, target: MapNode) {
  if (source.id === target.id) return { sourceHandle: "top-out", targetHandle: "top-in" };
  const dx = target.x - source.x, dy = target.y - source.y;
  if (Math.abs(dx) >= Math.abs(dy) * (NODE_WIDTH / NODE_HEIGHT) * 0.6) {
    return dx > 0 ? { sourceHandle: "right-out", targetHandle: "left-in" } : { sourceHandle: "left-out", targetHandle: "right-in" };
  }
  return dy > 0 ? { sourceHandle: "bottom-out", targetHandle: "top-in" } : { sourceHandle: "top-out", targetHandle: "bottom-in" };
}

const subscribeNothing = () => () => {};

export function Graph({ data, showLookups, animate, selection, onSelect, trace, className }: Props) {
  const { resolvedTheme } = useTheme();
  // The server cannot know the theme: render light first, switch after hydration (no mismatch).
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const markers = MARKER[hydrated && resolvedTheme === "dark" ? "dark" : "light"];

  const nodes = useMemo<Node[]>(() => {
    const right = Math.max(...data.bands.map((b) => b.x + b.w)), bottom = Math.max(...data.bands.map((b) => b.y + b.h));
    const anchors: Node[] = [
      { id: "anchor-top-left", type: "anchor", position: { x: Math.min(...data.bands.map((b) => b.x)), y: Math.min(...data.bands.map((b) => b.y)) }, data: {}, selectable: false, focusable: false },
      { id: "anchor-bottom-right", type: "anchor", position: { x: right, y: bottom }, data: {}, selectable: false, focusable: false },
    ];
    return [...anchors, ...data.nodes.map<TableNodeType>((node) => {
      const lines = data.register.filter((r) => node.rules.includes(r.ruleId));
      const count = (status: string) => lines.filter((r) => r.status === status).length;
      return {
        id: node.id,
        type: "table",
        position: { x: node.x, y: node.y },
        data: {
          node,
          findings: { confirmed: count("confirmed"), unresolved: count("unresolved"), cleared: count("cleared") },
          selected: selection?.kind === "node" && selection.id === node.id,
          dimmed: Boolean(trace) && !trace?.nodes[node.id],
          traceStatus: trace?.nodes[node.id],
        },
      };
    })];
  }, [data, selection, trace]);

  const edges = useMemo<Edge[]>(() => {
    const byId = Object.fromEntries(data.nodes.map((n) => [n.id, n]));
    return data.edges
      .filter((edge) => edge.kind !== "lookup" || showLookups || trace?.edges[edge.id])
      .map<StatusEdgeType>((edge) => {
        const traceStatus = trace?.edges[edge.id];
        const tone = traceStatus ? HOP_STATUS[traceStatus].tone : JOIN_STATUS[edge.status].tone;
        return {
          id: edge.id,
          type: "status",
          source: edge.source,
          target: edge.target,
          ...handles(byId[edge.source], byId[edge.target]),
          animated: trace ? Boolean(traceStatus) : animate && edge.kind !== "lookup",
          markerEnd: { type: MarkerType.ArrowClosed, color: markers[tone], width: 14, height: 14 },
          data: {
            edge,
            issue: trace ? "" : edgeIssue(edge.id, data.health),
            selected: selection?.kind === "edge" && selection.id === edge.id,
            dimmed: Boolean(trace) && !traceStatus,
            traceStatus,
            onSelect: onSelect ? (id: string) => onSelect({ kind: "edge", id }) : undefined,
          },
        };
      });
  }, [data, showLookups, animate, selection, trace, markers, onSelect]);

  return (
    <div className={cn("h-full w-full", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.02 }}
        minZoom={0.25}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, node) => node.type === "table" && onSelect?.({ kind: "node", id: node.id })}
        onEdgeClick={(_, edge) => onSelect?.({ kind: "edge", id: edge.id })}
        onPaneClick={() => onSelect?.(null)}
      >
        <BandLayer bands={data.bands} />
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  );
}
