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

function IndicatorCard({ indicator: i }: { indicator: Indicator }) {
  const proposed = i.status === "proposed";
  const bookingAlerts = i.id === "I2" && i.unit === "trades";
  const bookingDelay = bookingAlerts ? i.threshold.match(/\b\d+(?:\.\d+)? minutes(?= after receipt\b)/)?.[0] : undefined;
  const valueLabel = bookingDelay ? `${i.unit} above latency threshold (${bookingDelay})` : i.unit;
  const lines = drawable(i.series);
  return (
    <article
      id={`indicator-${i.id}`}
      data-testid={`indicator-${i.id}`}
      className="@container min-w-0 scroll-mt-4 space-y-3 rounded-xl border bg-block p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h3 className="text-base font-semibold">{i.name}</h3>
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
          {i.value !== null && <span className="text-sm text-muted-foreground">{valueLabel}</span>}
        </div>
      )}
      {lines.length > 0 && (
        <div className={cn("grid gap-3", lines.length > 1 && !bookingAlerts && "@min-[24rem]:grid-cols-2")}>
          {lines.map((s) => (
            <figure key={`${s.key}/${s.period}`} className="min-w-0 space-y-1 rounded-lg border bg-background p-2.5">
              {s.key !== "all" && <figcaption className="text-xs font-medium text-muted-foreground">{s.key}</figcaption>}
              <Sparkline points={s.points} label={s.key === "all" ? i.name : `${i.name}, ${s.key}`} unit={i.unit} period={s.period} />
            </figure>
          ))}
        </div>
      )}
      <DetailDisclosure label="Indicator details" accessibleLabel={`Indicator details for ${i.name}`} className="border-t pt-1">
        <dl className="space-y-2.5">
          {proposed ? <Fact label="Data needed">{i.inputsNeeded}</Fact> : (
            <>
              {i.id === "I4" && (
                <Fact label="What it measures">
                  Share of assessed securities held at the snapshot with an eligible, current price that passes the vendor agreement check.
                </Fact>
              )}
              <Fact label="Threshold">{i.threshold}{bookingAlerts && ". Historical replay by feed and cutoff day."}</Fact>
              <Fact label={bookingAlerts ? "Feed days with alerts" : "Recorded breaches"}>
                <span className="font-mono tabular-nums">{fmtCount(i.breaches)}</span>
              </Fact>
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
                {l.medianLeadDays !== null && (
                  <>, median lead {bookingAlerts ? `${fmtCount(l.medianLeadDays * 1440)} minutes` : `${fmtNumber(l.medianLeadDays)} days`}</>
                )}
                {" · "}{l.verdict}
              </p>
            ))}
          </div>
        )}
      </DetailDisclosure>
    </article>
  );
}

export function IndicatorCards({ indicators }: { indicators: Indicator[] }) {
  const leading = indicators.filter((indicator) => indicator.type === "Leading");
  const booking = leading.find((indicator) => indicator.id === "I2");
  const stackOrder: Record<string, number> = { I4: 0, I3: 1, I1: 2 };
  const stacked = leading.filter((indicator) => indicator.id !== "I2")
    .sort((a, b) => (stackOrder[a.id] ?? 3) - (stackOrder[b.id] ?? 3));

  return (
    <div className="@container">
      <div className="flex flex-col items-stretch gap-4 @min-[48rem]:flex-row @min-[48rem]:items-start">
        {stacked.length > 0 && (
          <div className="grid min-w-0 flex-1 gap-4">
            {stacked.map((indicator) => <IndicatorCard key={indicator.id} indicator={indicator} />)}
          </div>
        )}
        {booking && (
          <div className="min-w-0 flex-1">
            <IndicatorCard indicator={booking} />
          </div>
        )}
      </div>
    </div>
  );
}
