import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { Metric, RegisterStatus } from "@/components/common";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BLANK, PLATFORM_SCORE_TARGET, fmtCount, fmtScore, fmtShare, fmtUsd, fmtUsdShort, largestScenario, leadingBreaches, scenarioHref } from "@/lib/executive";
import type { ExecutiveData } from "@/lib/executive-types";
import { PartMissing } from "./part-missing";
import { ScoreTarget } from "./score-target";
import { IndicatorTriggerMatrix } from "./indicator-trigger-matrix";
import { ScenarioCoverage } from "./scenario-coverage";

function HeadlineCard({ id, title, value, summary, caption, children }: {
  id: string; title: string; value: React.ReactNode; summary?: React.ReactNode; caption?: React.ReactNode; children: React.ReactNode;
}) {
  const captionId = `${id}-caption`;
  return (
    <div className="min-w-0">
      <Collapsible data-testid={id} className="rounded-2xl border bg-block">
        <CollapsibleTrigger
          aria-describedby={caption ? captionId : undefined}
          className="group flex min-h-28 w-full flex-col items-start justify-between gap-3 rounded-2xl px-5 py-4 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring @min-[44rem]:min-h-36"
        >
          <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
            {title}
            <span className="grid size-7 shrink-0 place-items-center rounded-full border bg-background text-brand-line">
              <ChevronDown aria-hidden className="size-4 transition-transform group-data-[panel-open]:rotate-180 motion-reduce:transition-none" />
            </span>
          </span>
          <span className="font-sans text-[clamp(2.625rem,6cqi,3.75rem)] leading-none font-semibold tracking-[-0.055em] tabular-nums">
            {value}
          </span>
        </CollapsibleTrigger>
        {summary && <div className="px-5 pb-4">{summary}</div>}
        <CollapsibleContent className="space-y-2 border-t px-5 py-4">
          {children}
        </CollapsibleContent>
      </Collapsible>
      {caption && <div id={captionId} className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">{caption}</div>}
    </div>
  );
}

export function HeadlineTiles({ data }: { data: ExecutiveData }) {
  const scenario = largestScenario(data.scenarios);
  const leading = leadingBreaches(data.indicators);
  const missingScore = data.missing.includes("scorecard");
  const missingImpact = data.missing.includes("impact");
  const missingIndicators = data.missing.includes("indicators");
  return (
    <div className="@container">
      <div className="grid items-start gap-4 @min-[44rem]:grid-cols-3">
        <HeadlineCard
          id="tile-platform"
          title="Platform Score"
          value={<span data-testid="score">{fmtScore(data.platform?.score ?? null)}</span>}
          summary={<ScoreTarget score={data.platform?.score ?? null} minimum={PLATFORM_SCORE_TARGET} />}
        >
          {missingScore ? <PartMissing part="scorecard" /> : (
            <>
              <div data-testid="coverage"><Metric label="Coverage" value={fmtScore(data.platform?.coverage ?? null)} /></div>
              <div data-testid="confirmed-only"><Metric label="Confirmed-only score" value={fmtScore(data.platform?.confirmedOnly ?? null)} /></div>
              {data.unresolvedCredit !== null && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Unresolved-only cases receive {
                    new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 2 }).format(data.unresolvedCredit)
                  } credit in the main score. Confirmed defects receive zero credit.
                </p>
              )}
            </>
          )}
        </HeadlineCard>
        <HeadlineCard
          id="tile-impact"
          title="Largest Impact Scenario"
          value={<span title={scenario ? fmtUsd(scenario.grossUsd) : undefined}>{scenario ? fmtUsdShort(scenario.grossUsd) : BLANK}</span>}
          summary={!missingImpact && scenario && <ScenarioCoverage scenario={scenario} />}
          caption={scenario && (
            <>
              <p className="font-medium">{scenario.scenario}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Gross estimate for one scenario</span>
                <RegisterStatus status={scenario.evidence} />
              </div>
            </>
          )}
        >
          {missingImpact ? <PartMissing part="impact" /> : scenario ? (
            <>
              <Metric label="Share of rows priced" value={fmtShare(scenario.valuationCoverage)} />
              <Link href={scenarioHref(scenario.scenario)} className="text-sm font-medium text-brand-line underline-offset-2 hover:underline">
                View scenario details
              </Link>
            </>
          ) : <p className="text-sm text-muted-foreground">No scenario is priced in this run.</p>}
        </HeadlineCard>
        <HeadlineCard
          id="tile-leading"
          title="Early Warning Signs Triggered"
          value={missingIndicators ? BLANK : `${fmtCount(leading.breaching)} of ${fmtCount(leading.computed)}`}
          summary={!missingIndicators && <IndicatorTriggerMatrix entries={leading.entries} />}
          caption={!missingIndicators && leading.computed > 0 && "During the reporting period"}
        >
          {missingIndicators ? <PartMissing part="indicators" /> : (
            <>
              <p className="text-xs text-muted-foreground">
                Reporting period {leading.start ? (
                  <>
                    <time dateTime={leading.start}>{leading.start}</time>
                    {leading.start !== leading.end && <> to <time dateTime={leading.end}>{leading.end}</time></>}
                  </>
                ) : "unavailable"}
              </p>
              {leading.entries.length === 0 ? <p className="text-sm text-muted-foreground">No computed leading indicators.</p> : (
                <ul className="space-y-2 text-sm">
                  {leading.entries.map(({ indicator, recordedBreach }) => (
                    <li key={indicator.id} className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                      <Link href={`#indicator-${indicator.id}`} className="font-medium text-brand-line underline-offset-2 hover:underline">
                        {/^I[1-4]$/.test(indicator.id) && <span aria-hidden className="mr-1.5 text-xs text-muted-foreground">L{indicator.id}</span>}
                        {indicator.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {recordedBreach ? "Recorded a breach" : indicator.breaches === null ? "Breach count unavailable" : "No breach recorded"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </HeadlineCard>
      </div>
    </div>
  );
}
