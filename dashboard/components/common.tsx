import type { Counts } from "@/lib/findings";
import { REGISTER_STATUS, toneColor, toneText } from "@/lib/status";
import type { MapSource } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "bad" | "info";

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: toneColor(tone) }} />;
}

export function Pill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  const color = toneColor(tone);
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", className)}
      style={{ color: toneText(tone), borderColor: `color-mix(in oklab, ${color} 35%, transparent)`, background: `color-mix(in oklab, ${color} 10%, transparent)` }}
    >
      {children}
    </span>
  );
}

export function RegisterStatus({ status }: { status: string }) {
  return <Pill tone={REGISTER_STATUS[status] ?? "info"}>{status}</Pill>;
}

export function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: Tone }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums" style={tone ? { color: toneText(tone) } : undefined}>
        {value}
      </span>
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A control-map handoff number: brand blue, because it names one of our checks (never a health colour). */
export function CheckBadge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={cn("flex size-[22px] shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white", className)}
    >
      {n}
    </span>
  );
}

/** Register findings by status as small dots with counts (red confirmed, amber unresolved, green cleared). */
export function FindingDots({ counts, className }: { counts: Counts; className?: string }) {
  const shown = (["confirmed", "unresolved", "cleared"] as const).filter((s) => counts[s] > 0);
  if (!shown.length) return null;
  return (
    <span className={cn("inline-flex items-center gap-2 text-[11px] font-semibold tabular-nums", className)}>
      {shown.map((status) => (
        <span key={status} className="inline-flex items-center gap-1" title={`${counts[status]} ${status} in the register`}>
          <Dot tone={REGISTER_STATUS[status]} />
          {counts[status]}
        </span>
      ))}
    </span>
  );
}

/** Where a table's data comes from: solid when the data names it, dashed and italic when it is our reasoning. */
export function SourceChip({ source, className }: { source: MapSource; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full px-2 py-px text-[11px]",
        source.evidence === "data"
          ? "bg-[var(--chip-data)] font-semibold"
          : "border border-dashed border-[var(--chip-reason-line)] text-[var(--chip-reason-text)] italic",
        className,
      )}
      title={source.evidence === "data" ? `Seen in the data: ${source.column}` : source.reason}
    >
      {source.label}
    </span>
  );
}
