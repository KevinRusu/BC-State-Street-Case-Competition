import { BaseEdge, EdgeLabelRenderer, type Edge, type EdgeProps } from "@xyflow/react";
import { CheckBadge, FindingDots } from "@/components/common";
import { tagShown, type Counts } from "@/lib/findings";
import { curve } from "@/lib/geometry";
import { JOIN_STATUS, toneColor, toneText } from "@/lib/status";
import { findingSummary, traceTone } from "@/lib/trace-findings";
import type { HopStatus, MapEdge, RegisterMark } from "@/lib/types";
import { cn } from "@/lib/utils";

export type StatusEdgeData = {
  edge: MapEdge;
  issue: string;
  counts: Counts;
  selected: boolean;
  dimmed: boolean;
  /** Trace badges describe this record's findings, rather than population-wide counts. */
  inTrace: boolean;
  traceStatus?: HopStatus;
  traceFindings?: RegisterMark[];
  onSelect?: (id: string) => void;
};
export type StatusEdgeType = Edge<StatusEdgeData, "status">;

const WIDTH = { handoff: 2.5, flow: 2, lookup: 1.25 };
// Where the tag sits next to its point on the line, by tag side; `gap` clears the check badge when there is one.
const offset = (side: MapEdge["tagSide"], gap: number) =>
  ({
    right: `translate(${gap}px, -50%)`,
    left: `translate(calc(-100% - ${gap}px), -50%)`,
    above: `translate(-50%, calc(-100% - ${gap}px))`,
    below: `translate(-50%, ${gap}px)`,
  })[side];

/**
 * A join on the map, coloured by the health of its raw keys (or by the trace hop it carries). A handoff carries its
 * check number in brand blue; a small tag holds the findings that count on it and the key problem, if any.
 */
export function StatusEdge(props: EdgeProps<StatusEdgeType>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd } = props;
  if (!data) return null;
  const { edge, issue, counts, selected, dimmed, inTrace, traceStatus, traceFindings = [], onSelect } = data;
  const tone = traceStatus ? traceTone(traceStatus, traceFindings) : JOIN_STATUS[edge.status].tone;
  const color = toneColor(tone);

  let path: string, point: { x: number; y: number };
  if (edge.source === edge.target) {
    path = `M ${sourceX - 45} ${sourceY} C ${sourceX - 45} ${sourceY - 80}, ${sourceX + 45} ${sourceY - 80}, ${sourceX + 45} ${sourceY}`;
    point = { x: sourceX, y: sourceY - 62 };
  } else {
    const line = curve({ x: sourceX, y: sourceY, position: sourcePosition }, { x: targetX, y: targetY, position: targetPosition });
    path = line.path;
    point = line.at(edge.tagAt);
  }
  const width = WIDTH[edge.kind] + (selected || traceStatus ? 1.5 : 0);
  const showTag = inTrace ? Boolean(findingSummary(traceFindings)) : tagShown(edge.kind, counts, issue, false);
  const select = () => onSelect?.(edge.id);

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
        <div
          className={cn("nodrag nopan absolute transition-opacity", dimmed && "opacity-15")}
          style={{ transform: `translate(${point.x}px, ${point.y}px)`, pointerEvents: "all" }}
        >
          {edge.handoff !== null && (
            <button
              type="button"
              onClick={select}
              title={edge.label}
              className={cn("absolute -translate-1/2 cursor-pointer rounded-full", selected && "ring-2 ring-[var(--brand-line)] ring-offset-1")}
            >
              <CheckBadge n={edge.handoff} className="border-2 border-[var(--canvas)]" />
            </button>
          )}
          {showTag && (
            <button
              type="button"
              onClick={select}
              title={edge.label}
              className="absolute flex h-[18px] cursor-pointer items-center gap-1.5 rounded-full bg-card px-2 whitespace-nowrap shadow-[0_1px_3px_rgba(16,24,40,0.16)] ring-1 ring-black/5 dark:ring-white/10"
              style={{ transform: offset(edge.tagSide, edge.handoff === null ? 4 : 14) }}
            >
              <FindingDots counts={counts} className="text-[10.5px]" />
              {issue && (
                <span className="text-[10.5px] font-semibold" style={{ color: toneText(tone) }}>
                  {issue}
                </span>
              )}
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
