"use client";

import { useState } from "react";
import { fmtValue, nearestIndex, seriesAxis, sparkline } from "@/lib/executive";
import type { SeriesPoint } from "@/lib/executive-types";
import { cn } from "@/lib/utils";

const WIDTH = 256;
const HEIGHT = 62;
const PAD = 4;

/**
 * An indicator's trend line with its axes: the unit and the values at the top and bottom of the range, the first and
 * last dates with the series period, and a dashed line per threshold. Hovering, or focusing and using the arrow keys,
 * shows the nearest point's date, value, limit and whether it breached.
 */
export function Sparkline({ points, label, unit, period }: { points: SeriesPoint[]; label: string; unit: string; period: string }) {
  const [active, setActive] = useState<number | null>(null);
  const line = sparkline(points, WIDTH, HEIGHT);
  if (!line) return null;
  const shown = line.points;
  const point = active === null ? null : shown[active];
  const value = (v: number) => `${fmtValue(v, unit)} ${unit}`;

  const pick = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * (WIDTH + 2 * PAD) - PAD;
    setActive(nearestIndex(shown.length, x / WIDTH));
  };
  const step = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const last = shown.length - 1;
    const next = { ArrowLeft: (active ?? last) - 1, ArrowRight: (active ?? -1) + 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(Math.min(last, Math.max(0, next)));
  };
  const left = point ? ((point.x + PAD) / (WIDTH + 2 * PAD)) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="text-[10px] text-muted-foreground">{unit}</div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-1.5">
        <div className="flex flex-col justify-between py-0.5 text-right text-[10px] tabular-nums text-muted-foreground" aria-hidden>
          <span>{fmtValue(line.high, unit)}</span>
          <span>{fmtValue(line.low, unit)}</span>
        </div>
        <div className="relative">
          <svg
            role="img"
            aria-label={`${label}: ${fmtValue(line.low, unit)} to ${fmtValue(line.high, unit)} ${unit}. Use the arrow keys to read each point.`}
            tabIndex={0}
            viewBox={`${-PAD} ${-PAD} ${WIDTH + 2 * PAD} ${HEIGHT + 2 * PAD}`}
            className="block h-auto w-full cursor-crosshair rounded-sm text-brand-line outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onPointerMove={pick}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive((a) => a ?? shown.length - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={step}
          >
            <path d={`M0 0 H${WIDTH} M0 ${HEIGHT} H${WIDTH}`} fill="none" stroke="var(--border)" />
            {line.limits.map((limit) => (
              <path
                key={limit.value}
                data-testid="spark-limit"
                d={`M0 ${limit.y} H${WIDTH}`}
                fill="none"
                stroke="var(--status-bad)"
                strokeOpacity={0.7}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {point && <path d={`M${point.x} 0 V${HEIGHT}`} stroke="var(--muted-foreground)" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />}
            <path d={line.path} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {line.marks.map((mark) => (
              <circle key={mark.x} cx={mark.x} cy={mark.y} r={2.5} fill="var(--status-bad)" stroke="var(--background)" strokeWidth={0.75} />
            ))}
            {point && (
              <circle cx={point.x} cy={point.y} r={3.5} fill={point.breach ? "var(--status-bad)" : "currentColor"} stroke="var(--background)" strokeWidth={1.25} />
            )}
          </svg>
          {point && (
            <div
              role="status"
              data-testid="spark-tooltip"
              className={cn(
                "pointer-events-none absolute bottom-full z-10 mb-1 w-max max-w-56 rounded-md border bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md",
                left < 25 ? "-translate-x-[10%]" : left > 75 ? "-translate-x-[90%]" : "-translate-x-1/2",
              )}
              style={{ left: `${left}%` }}
            >
              <time dateTime={point.start} className="block font-medium">{point.start}</time>
              <span className="block tabular-nums">{value(point.value)}</span>
              <span className="block text-muted-foreground tabular-nums">
                {point.threshold === null ? "No limit recorded" : `Limit ${value(point.threshold)}`}
              </span>
              <span className={cn("block", point.breach ? "font-medium text-status-bad" : "text-muted-foreground")}>
                {point.breach ? "Breach" : "Within limit"}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-1.5 text-[10px] tabular-nums text-muted-foreground">
        <span aria-hidden className="invisible">{fmtValue(line.high, unit)}</span>
        <div className="space-y-0.5">
          <div className="flex flex-wrap justify-between gap-x-2">
            <time dateTime={shown[0].start}>{shown[0].start}</time>
            <time dateTime={shown.at(-1)!.start}>{shown.at(-1)!.start}</time>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-2">
            <span>{seriesAxis(period)}</span>
            {line.limits.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <svg aria-hidden width="14" height="4" className="overflow-visible">
                  <path d="M0 2 H14" stroke="var(--status-bad)" strokeOpacity={0.7} strokeDasharray="4 3" />
                </svg>
                {line.limits.map((l) => `limit ${value(l.value)}`).join(", ")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
