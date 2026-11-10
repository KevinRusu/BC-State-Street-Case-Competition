import { Fragment } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { FindingDots, SourceChip } from "@/components/common";
import type { Counts } from "@/lib/findings";
import { HOP_STATUS, toneColor, toneText } from "@/lib/status";
import { findingSummary, traceTone } from "@/lib/trace-findings";
import type { HopStatus, MapNode, RegisterMark } from "@/lib/types";
import { cn } from "@/lib/utils";

export const NODE_WIDTH = 180;

export type TableNodeData = {
  node: MapNode;
  counts: Counts;
  selected: boolean;
  dimmed: boolean;
  traceStatus?: HopStatus;
  traceFindings?: RegisterMark[];
  traceMode?: boolean;
  traceControl?: { expanded: boolean; controls: string; onToggle: () => void };
};
export type TableNodeType = Node<TableNodeData, "table">;

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left];
// A line can leave or enter at the middle of a side, or 30 % (-a) / 70 % (-b) along it (GRAPH from/to_handle).
const SLOTS = [["", 50], ["-a", 30], ["-b", 70]] as const;

/** A table on the map: name, where its data comes from, and how many register findings count on it. */
export function TableNode({ data }: NodeProps<TableNodeType>) {
  const { node, counts, selected, dimmed, traceStatus, traceFindings = [], traceMode, traceControl } = data;
  const finding = findingSummary(traceFindings);
  const tone = traceStatus ? traceTone(traceStatus, traceFindings) : undefined;
  const linkWarning = traceStatus === "missing" || (traceStatus === "fan_out" && finding?.tone === "ok");
  const ring = tone ? toneColor(tone) : selected ? "var(--brand-line)" : undefined;
  return (
    <div
      data-trace-tone={tone}
      className={cn(
        "relative flex flex-col items-start gap-1.5 rounded-[10px] bg-card px-3 pt-3.5 pb-2.5 text-card-foreground shadow-[0_1px_3px_rgba(16,24,40,0.14)] transition-all",
        dimmed && "opacity-65",
      )}
      style={{ width: NODE_WIDTH, ...(ring ? { boxShadow: `0 0 0 ${traceStatus ? 3 : 2.5}px ${ring}` } : {}) }}
    >
      {traceMode && (
        <button
          type="button"
          aria-label={`${node.label} steps`}
          aria-expanded={traceControl?.expanded}
          aria-controls={traceControl?.controls}
          disabled={!traceControl}
          title={traceControl ? `${traceControl.expanded ? "Close" : "Open"} ${node.label} steps` : "Not part of this record's trace"}
          className="nodrag nopan absolute inset-0 z-10 rounded-[10px] enabled:cursor-pointer enabled:hover:bg-brand/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand disabled:cursor-default"
          onClick={(event) => { event.stopPropagation(); traceControl?.onToggle(); }}
        />
      )}
      {SIDES.flatMap((side) =>
        SLOTS.map(([slot, at]) => {
          const along = side === Position.Top || side === Position.Bottom ? { left: `${at}%` } : { top: `${at}%` };
          return (
            <Fragment key={side + slot}>
              <Handle type="source" id={`out-${side}${slot}`} position={side} style={along} className="opacity-0" isConnectable={false} />
              <Handle type="target" id={`in-${side}${slot}`} position={side} style={along} className="opacity-0" isConnectable={false} />
            </Fragment>
          );
        }),
      )}
      <span className="text-[15px] leading-snug font-semibold">{node.label}</span>
      {node.sources.map((source) => (
        <SourceChip key={source.label} source={source} />
      ))}
      {traceStatus && (
        <span
          className="text-[10px] font-medium"
          style={{ color: toneText(tone!) }}
          title={[HOP_STATUS[traceStatus].label, ...traceFindings.map((m) => m.finding)].join("; ")}
        >
          {linkWarning ? HOP_STATUS[traceStatus].label : finding?.label ?? HOP_STATUS[traceStatus].label}
        </span>
      )}
      {(counts.confirmed > 0 || counts.unresolved > 0 || counts.cleared > 0) && (
        <span className="absolute -top-2.5 right-1.5 rounded-full bg-card px-2 py-0.5 shadow-[0_1px_3px_rgba(16,24,40,0.18)] ring-1 ring-black/5 dark:ring-white/10">
          <FindingDots counts={counts} />
        </span>
      )}
    </div>
  );
}
