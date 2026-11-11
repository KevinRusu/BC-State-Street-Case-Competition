import { Pill } from "@/components/common";
import { drawable, fmtCount, fmtNumber, fmtValue } from "@/lib/executive";
import type { Indicator } from "@/lib/executive-types";
import { Sparkline } from "./sparkline";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-xs">
      <span className="text-muted-foreground">{label} </span>
      {children}
    </div>
  );
}

/** One card per indicator: its value, threshold, breaches, trend lines and look-backs. A proposed one has no value. */
export function IndicatorCards({ indicators }: { indicators: Indicator[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {indicators.map((i) => {
        const proposed = i.status === "proposed";
        const lines = drawable(i.series);
        return (
          <article key={i.id} data-testid={`indicator-${i.id}`} className="min-w-0 space-y-2 rounded-2xl bg-block px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold">{i.name}</h4>
              <Pill tone="info">{i.type}</Pill>
              <Pill tone="info">{i.status}</Pill>
            </div>
            {proposed ? (
              <p className="text-sm text-muted-foreground">Proposed: needs {i.inputsNeeded}</p>
            ) : (
              <>
                <div className="font-mono text-xl font-semibold tabular-nums">{fmtValue(i.value, i.unit)}{i.value !== null && <span className="ml-1.5 font-sans text-sm font-normal text-muted-foreground">{i.unit}</span>}</div>
                <Fact label="Threshold">{i.threshold}</Fact>
                <div className="flex flex-wrap gap-x-4">
                  <Fact label="Breaches"><span className="font-mono tabular-nums">{fmtCount(i.breaches)}</span></Fact>
                  {i.firstBreach !== "" && <Fact label="First breach">{i.firstBreach}</Fact>}
                </div>
                {lines.length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                    {lines.map((s) => (
                      <figure key={s.key} className="space-y-0.5">
                        <Sparkline points={s.points} label={`${i.name}, ${s.key}`} />
                        {s.key !== "all" && <figcaption className="text-[11px] text-muted-foreground">{s.key}</figcaption>}
                      </figure>
                    ))}
                  </div>
                )}
                {i.lookback.length > 0 && (
                  <div className="space-y-1 border-t pt-2">
                    {i.lookback.map((l) => (
                      <p key={l.lagging} className="text-xs">
                        {fmtCount(l.flaggedEarlier)} of {fmtCount(l.laggingKeys)} {l.lagging} flagged earlier
                        {l.medianLeadDays !== null && <>, median lead {fmtNumber(l.medianLeadDays)} days</>}: {l.verdict}
                      </p>
                    ))}
                    <p className="text-[11px] text-muted-foreground">A look-back on this release, not predictive accuracy.</p>
                  </div>
                )}
              </>
            )}
            <Fact label="Owner">{i.owner}</Fact>
          </article>
        );
      })}
    </div>
  );
}
