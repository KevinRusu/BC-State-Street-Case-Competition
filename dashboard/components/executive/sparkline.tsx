import { sparkline } from "@/lib/executive";
import type { SeriesPoint } from "@/lib/executive-types";

const W = 120;
const H = 28;

/** A tiny trend line; breach points are marked in the red tone. Nothing is drawn without two valued points. */
export function Sparkline({ points, label }: { points: SeriesPoint[]; label: string }) {
  const line = sparkline(points, W, H);
  if (!line) return null;
  return (
    <svg role="img" aria-label={label} width={W} height={H} viewBox={`-3 -3 ${W + 6} ${H + 6}`} className="shrink-0 overflow-visible text-muted-foreground">
      <path d={line.path} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {line.marks.map((m, i) => (
        <circle key={i} cx={m.x} cy={m.y} r={2.5} fill="var(--status-bad)" stroke="var(--background)" strokeWidth={1} />
      ))}
    </svg>
  );
}
