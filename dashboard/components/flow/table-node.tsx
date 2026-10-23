import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { HOP_STATUS, fmt, toneColor } from "@/lib/status";
import type { HopStatus, MapNode } from "@/lib/types";
import { cn } from "@/lib/utils";

export const NODE_WIDTH = 230;
export const NODE_HEIGHT = 118;

export type TableNodeData = {
  node: MapNode;
  findings: { confirmed: number; unresolved: number; cleared: number };
  selected: boolean;
  dimmed: boolean;
  traceStatus?: HopStatus;
};
export type TableNodeType = Node<TableNodeData, "table">;

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left];

/** A table on the map: name, grain, row count, and how many register findings its rules hold. */
export function TableNode({ data }: NodeProps<TableNodeType>) {
  const { node, findings, selected, dimmed, traceStatus } = data;
  const ring = traceStatus ? toneColor(HOP_STATUS[traceStatus].tone) : undefined;
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border bg-card px-3.5 py-3 text-card-foreground shadow-sm transition-all",
        selected && "ring-2 ring-primary",
        dimmed && "opacity-30",
      )}
      style={{ width: NODE_WIDTH, minHeight: NODE_HEIGHT, ...(ring ? { boxShadow: `0 0 0 3px ${ring}` } : {}) }}
    >
      {SIDES.map((side) => (
        <span key={side}>
          <Handle type="source" id={`${side}-out`} position={side} className="opacity-0" isConnectable={false} />
          <Handle type="target" id={`${side}-in`} position={side} className="opacity-0" isConnectable={false} />
        </span>
      ))}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{node.label}</span>
        {traceStatus && (
          <span className="text-[10px] font-medium" style={{ color: ring }}>
            {HOP_STATUS[traceStatus].label}
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground italic">{node.grain}</div>
      {node.note && <div className="text-[11px] text-muted-foreground">{node.note}</div>}
      <div className="mt-auto flex items-center justify-between pt-1 text-xs">
        <span className="font-mono tabular-nums">{fmt(node.rows)} rows</span>
        <span className="flex items-center gap-2">
          {findings.confirmed > 0 && <Count tone="bad" n={findings.confirmed} title="confirmed findings" />}
          {findings.unresolved > 0 && <Count tone="warn" n={findings.unresolved} title="unresolved findings" />}
          {findings.cleared > 0 && <Count tone="ok" n={findings.cleared} title="cleared look-alikes" />}
        </span>
      </div>
    </div>
  );
}

function Count({ tone, n, title }: { tone: "bad" | "warn" | "ok"; n: number; title: string }) {
  return (
    <span className="flex items-center gap-1" title={`${n} ${title} in the register`}>
      <span className="size-2 rounded-full" style={{ background: toneColor(tone) }} />
      <span className="tabular-nums">{n}</span>
    </span>
  );
}
