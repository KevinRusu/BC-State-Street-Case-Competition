import { sparkline } from "@/lib/executive";
import type { SeriesPoint } from "@/lib/executive-types";

const WIDTH = 256;
const HEIGHT = 62;

export function Sparkline({ points, label }: { points: SeriesPoint[]; label: string }) {
  const line = sparkline(points, WIDTH, HEIGHT);
  if (!line) return null;
  const dates = points.filter((p) => p.value !== null).map((p) => p.start);

  return (
    <>
      <svg role="img" aria-label={label} viewBox={`-4 -4 ${WIDTH + 8} ${HEIGHT + 8}`} className="block h-auto w-full text-brand-line">
        <path d={`M0 0 H${WIDTH} M0 ${HEIGHT / 2} H${WIDTH} M0 ${HEIGHT} H${WIDTH}`} fill="none" stroke="var(--border)" />
        <path d={line.path} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {line.marks.map((mark) => (
          <circle key={mark.x} cx={mark.x} cy={mark.y} r={2.5} fill="var(--status-bad)" stroke="var(--background)" strokeWidth={0.75} />
        ))}
      </svg>
      <div className="flex flex-wrap justify-between gap-x-2 text-[10px] tabular-nums text-muted-foreground">
        <time dateTime={dates[0]}>{dates[0]}</time>
        <time dateTime={dates.at(-1)}>{dates.at(-1)}</time>
      </div>
    </>
  );
}
