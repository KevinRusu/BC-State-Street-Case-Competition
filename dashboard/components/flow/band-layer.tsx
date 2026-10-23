import { ViewportPortal } from "@xyflow/react";
import type { Band } from "@/lib/types";

/**
 * The control map's office bands, drawn in flow coordinates behind everything. Edges render below nodes in
 * React Flow, so the bands cannot be nodes; z-index -1 inside the viewport puts them under the edges too.
 */
export function BandLayer({ bands }: { bands: Band[] }) {
  return (
    <ViewportPortal>
      {bands.map((band) => (
        <div
          key={band.id}
          className="pointer-events-none absolute top-0 left-0 rounded-2xl border border-border/40 px-5 py-4"
          style={{
            zIndex: -1,
            width: band.w,
            height: band.h,
            transform: `translate(${band.x}px, ${band.y}px)`,
            background: `var(--band-${band.id})`,
          }}
        >
          <div className="text-base font-semibold text-brand-navy">{band.label}</div>
          <div className="text-sm text-muted-foreground">{band.subtitle}</div>
        </div>
      ))}
    </ViewportPortal>
  );
}
