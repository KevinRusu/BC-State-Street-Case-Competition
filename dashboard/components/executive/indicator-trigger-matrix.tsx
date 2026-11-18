import { CircleCheck, CircleHelp, TriangleAlert } from "lucide-react";
import type { leadingBreaches } from "@/lib/executive";
import { toneText } from "@/lib/status";

// Display labels only; the indicator IDs and saved breach counts remain unchanged.
const INDICATORS = [
  { id: "I1", label: "LI1", name: "Security master" },
  { id: "I2", label: "LI2", name: "Booking alerts" },
  { id: "I3", label: "LI3", name: "Action readiness" },
  { id: "I4", label: "LI4", name: "Pricing readiness" },
] as const;

const STATES = {
  triggered: { label: "Triggered", icon: TriangleAlert, tone: "warn" },
  "not-triggered": { label: "Not triggered", icon: CircleCheck, tone: "ok" },
  unavailable: { label: "Unavailable", icon: CircleHelp, tone: "info" },
} as const;

export function IndicatorTriggerMatrix({ entries }: { entries: ReturnType<typeof leadingBreaches>["entries"] }) {
  const cells = INDICATORS.map((item) => {
    const entry = entries.find(({ indicator }) => indicator.id === item.id);
    const breaches = entry?.indicator.breaches;
    const state: keyof typeof STATES = breaches === null || breaches === undefined || !Number.isFinite(breaches) || breaches < 0
      ? "unavailable" : entry?.recordedBreach ? "triggered" : "not-triggered";
    return { ...item, state, indicatorName: entry?.indicator.name ?? item.name };
  });
  const shownStates: (keyof typeof STATES)[] = ["triggered", "not-triggered"];
  if (cells.some(({ state }) => state === "unavailable")) shownStates.push("unavailable");

  return (
    <div data-testid="indicator-trigger-matrix" className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {cells.map(({ id, label, name, indicatorName, state }) => {
          const { label: statusLabel, icon: Icon, tone } = STATES[state];
          const description = `${label}: ${indicatorName} — ${statusLabel.toLowerCase()} during the reporting period`;
          return (
            <div
              key={id}
              role="img"
              aria-label={description}
              title={description}
              data-testid={`trigger-${id}`}
              data-state={state}
              className="flex min-w-0 items-center justify-between gap-1.5 rounded-lg border bg-background px-2 py-1.5"
            >
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span data-testid="trigger-code" className="shrink-0 text-[10px] leading-4 font-semibold tracking-wide">{label}</span>
                <span data-testid="trigger-name" className="truncate text-[10px] leading-4 text-muted-foreground">{name}</span>
              </span>
              <Icon aria-hidden className="size-3.5 shrink-0" style={{ color: toneText(tone) }} />
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground" aria-hidden>
        {shownStates.map((state) => {
          const { label, icon: Icon, tone } = STATES[state];
          return (
            <span key={state} className="inline-flex items-center gap-1">
              <Icon className="size-3" style={{ color: toneText(tone) }} />
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
