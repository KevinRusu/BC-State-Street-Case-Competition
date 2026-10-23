import { REGISTER_STATUS, toneColor } from "@/lib/status";
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
      style={{ color, borderColor: `color-mix(in oklab, ${color} 35%, transparent)`, background: `color-mix(in oklab, ${color} 10%, transparent)` }}
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
      <span className="font-mono tabular-nums" style={tone ? { color: toneColor(tone) } : undefined}>
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
