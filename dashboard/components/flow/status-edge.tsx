import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { HOP_STATUS, JOIN_STATUS, toneColor } from "@/lib/status";
import type { HopStatus, MapEdge } from "@/lib/types";
import { cn } from "@/lib/utils";

export type StatusEdgeData = {
  edge: MapEdge;
  issue: string;
  selected: boolean;
  dimmed: boolean;
  traceStatus?: HopStatus;
  onSelect?: (id: string) => void;
};
export type StatusEdgeType = Edge<StatusEdgeData, "status">;

const WIDTH = { handoff: 2.5, flow: 2, lookup: 1.25 };

/** A join on the map, coloured by the health of its raw keys (or by the trace hop it carries). */
export function StatusEdge(props: EdgeProps<StatusEdgeType>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd } = props;
  if (!data) return null;
  const { edge, issue, selected, dimmed, traceStatus, onSelect } = data;
  const tone = traceStatus ? HOP_STATUS[traceStatus].tone : JOIN_STATUS[edge.status].tone;
  const color = toneColor(tone);
  const selfLoop = edge.source === edge.target;

  let path: string, labelX: number, labelY: number;
  if (selfLoop) {
    path = `M ${sourceX - 45} ${sourceY} C ${sourceX - 45} ${sourceY - 80}, ${sourceX + 45} ${sourceY - 80}, ${sourceX + 45} ${sourceY}`;
    [labelX, labelY] = [sourceX, sourceY - 62];
  } else {
    [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  }
  const width = WIDTH[edge.kind] + (selected || traceStatus ? 1.5 : 0);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={18}
        style={{
          stroke: color,
          strokeWidth: width,
          strokeDasharray: edge.inferred ? "6 5" : undefined,
          opacity: dimmed ? 0.12 : edge.kind === "lookup" && !selected ? 0.55 : 1,
          filter: selected ? `drop-shadow(0 0 4px ${color})` : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          onClick={() => onSelect?.(edge.id)}
          className={cn(
            "nodrag nopan absolute flex cursor-pointer items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-[11px] shadow-sm transition-opacity",
            dimmed && "opacity-15",
            selected && "ring-2 ring-primary",
          )}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
        >
          {edge.handoff !== null && (
            <span
              className="flex size-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: color }}
            >
              {edge.handoff}
            </span>
          )}
          <span className={cn(edge.kind === "handoff" ? "font-medium" : "text-muted-foreground")}>{edge.label}</span>
          {issue && (
            <span className="font-medium" style={{ color }}>
              · {issue}
            </span>
          )}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
