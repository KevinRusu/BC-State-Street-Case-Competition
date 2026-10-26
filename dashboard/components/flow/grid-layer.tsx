import { ViewportPortal } from "@xyflow/react";
import type { MapOffice, MapStage } from "@/lib/types";

/**
 * The map's grid, drawn in flow coordinates behind everything: office rows, the independent-sources strip, stage
 * headers and the "master data" bracket. Edges render below nodes in React Flow, so the grid cannot be nodes;
 * z-index -1 inside the viewport puts it under the edges too.
 */
export function GridLayer({ offices, stages }: { offices: MapOffice[]; stages: MapStage[] }) {
  const rows = offices.filter((o) => o.kind === "office");
  const top = Math.min(...rows.map((o) => o.y)), bottom = Math.max(...rows.map((o) => o.y + o.h));
  const flowFrom = stages[1]?.x ?? 0, flowTo = Math.max(...stages.map((s) => s.x + s.w)) - 6;
  return (
    <ViewportPortal>
      <div className="pointer-events-none absolute top-0 left-0" style={{ zIndex: -1 }}>
        {offices.map((office) => (
          <div
            key={office.id}
            className={`absolute rounded-2xl px-3.5 py-3 ${office.kind === "independent" ? "border border-dashed" : ""}`}
            style={{
              width: office.w,
              height: office.h,
              transform: `translate(${office.x}px, ${office.y}px)`,
              background: `var(--row-${office.id})`,
              borderColor: "var(--row-independent-line)",
            }}
          >
            <div className="w-[92px] text-sm leading-tight font-semibold">{office.label}</div>
          </div>
        ))}
        {stages.slice(1).map((stage) => (
          <div
            key={stage.id}
            className="absolute w-[3px] bg-[var(--canvas)]"
            style={{ height: bottom - top, transform: `translate(${stage.x - 1.5}px, ${top}px)` }}
          />
        ))}
        {stages.map((stage) => (
          <div key={stage.id} className="absolute" style={{ width: stage.w, transform: `translate(${stage.x}px, 0px)` }}>
            {stage.note && (
              <div className="mx-3.5 flex flex-col items-center">
                <span className="text-[11px] text-muted-foreground">{stage.note}</span>
                <span className="mt-0.5 h-1.5 w-full rounded-t-sm border-x border-t border-[var(--row-independent-line)]" />
              </div>
            )}
            <div
              className="absolute w-full text-center text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
              style={{ top: 44 }}
            >
              {stage.label}
            </div>
          </div>
        ))}
        <div className="absolute flex items-center gap-2" style={{ transform: `translate(${flowFrom}px, 12px)`, width: flowTo - flowFrom }}>
          <span className="shrink-0 text-[11px] text-muted-foreground">data flows this way</span>
          <span className="h-px flex-1 bg-[var(--row-independent-line)]" />
          <span className="-ml-2 size-0 border-y-4 border-l-[7px] border-y-transparent border-l-[var(--row-independent-line)]" />
        </div>
      </div>
    </ViewportPortal>
  );
}
