import { Pill } from "@/components/common";
import { drawable, fmtCount, fmtNumber, fmtValue } from "@/lib/executive";
import type { Indicator } from "@/lib/executive-types";
import { cn } from "@/lib/utils";
import { DetailDisclosure } from "./detail-disclosure";
import { Sparkline } from "./sparkline";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function IndicatorCards({ indicators }: { indicators: Indicator[] }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {indicators.map((i) => {
        const proposed = i.status === "proposed";
        const lines = drawable(i.series);
        return (
          <article
            key={i.id}
            id={`indicator-${i.id}`}
            data-testid={`indicator-${i.id}`}
            className="@container min-w-0 scroll-mt-4 space-y-3 rounded-xl border bg-block p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <h4 className="text-base font-semibold">{i.name}</h4>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded border bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{i.type}</span>
                {proposed ? <Pill tone="info">Proposed</Pill> : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">{i.status}</span>
                )}
              </div>
            </div>
            {!proposed && (
              <div className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-3xl leading-none font-semibold tracking-tight tabular-nums">{fmtValue(i.value, i.unit)}</span>
                {i.value !== null && <span className="text-sm text-muted-foreground">{i.unit}</span>}
              </div>
            )}
            {lines.length > 0 && (
              <div className={cn("grid gap-3", lines.length > 1 && "@min-[24rem]:grid-cols-2")}>
                {lines.map((s) => (
                  <figure key={`${s.key}/${s.period}`} className="min-w-0 space-y-1 rounded-lg border bg-background p-2.5">
                    {s.key !== "all" && <figcaption className="text-xs font-medium text-muted-foreground">{s.key}</figcaption>}
                    <Sparkline points={s.points} label={s.key === "all" ? i.name : `${i.name}, ${s.key}`} />
                  </figure>
                ))}
              </div>
            )}
            <DetailDisclosure label="Indicator details" accessibleLabel={`Indicator details for ${i.name}`} className="border-t pt-1">
              <dl className="space-y-2.5">
                {proposed ? <Fact label="Data needed">{i.inputsNeeded}</Fact> : (
                  <>
                    <Fact label="Threshold">{i.threshold}</Fact>
                    <Fact label="Recorded breaches"><span className="font-mono tabular-nums">{fmtCount(i.breaches)}</span></Fact>
                    {i.firstBreach !== "" && <Fact label="First breach"><time dateTime={i.firstBreach}>{i.firstBreach}</time></Fact>}
                  </>
                )}
                <Fact label="Owner">{i.owner}</Fact>
              </dl>
              {i.lookback.length > 0 && (
                <div className="mt-3 space-y-1 border-t pt-2">
                  <p className="text-xs font-medium text-muted-foreground">Retrospective look-back on this release</p>
                  {i.lookback.map((l) => (
                    <p key={l.lagging} className="text-xs">
                      {fmtCount(l.flaggedEarlier)} of {fmtCount(l.laggingKeys)} {l.lagging} flagged earlier
                      {l.medianLeadDays !== null && <>, median lead {fmtNumber(l.medianLeadDays)} days</>}
                      {" · "}{l.verdict}
                    </p>
                  ))}
                </div>
              )}
            </DetailDisclosure>
          </article>
        );
      })}
    </div>
  );
}
