import Link from "next/link";
import { Pill } from "@/components/common";
import { fmtCount, fmtShare, fmtUsd, fmtUsdShort, largestScenario, leadingBreaches, scenarioHref } from "@/lib/executive";
import type { ExecutiveData } from "@/lib/executive-types";
import { REGISTER_STATUS } from "@/lib/status";
import { PartMissing } from "./part-missing";
import { ScoreTrio } from "./score-trio";

const TILE = "min-w-0 rounded-2xl bg-block px-4 py-3 space-y-1.5";
const LABEL = "text-xs font-semibold tracking-wide text-muted-foreground uppercase";

/** Three tiles: the platform score, the largest impact scenario (never a total) and the leading indicators. */
export function HeadlineTiles({ data }: { data: ExecutiveData }) {
  const missing = (p: Parameters<typeof PartMissing>[0]["part"]) => data.missing.includes(p);
  const scenario = largestScenario(data.scenarios);
  const leading = leadingBreaches(data.indicators);
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div data-testid="tile-platform" className={TILE}>
        <div className={LABEL}>Platform score</div>
        {missing("scorecard") ? (
          <PartMissing part="scorecard" />
        ) : (
          <ScoreTrio trio={data.platform ?? { score: null, coverage: null, confirmedOnly: null }} size="lg" />
        )}
      </div>
      <div data-testid="tile-impact" className={TILE}>
        <div className={LABEL}>Largest impact scenario</div>
        {missing("impact") ? (
          <PartMissing part="impact" />
        ) : scenario ? (
          <>
            <div className="font-mono text-3xl font-semibold tabular-nums" title={fmtUsd(scenario.grossUsd)}>
              {fmtUsdShort(scenario.grossUsd)}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link href={scenarioHref(scenario.scenario)} className="text-brand-line underline-offset-2 hover:underline">
                {scenario.scenario}
              </Link>
              <Pill tone={REGISTER_STATUS[scenario.evidence] ?? "info"}>{scenario.evidence}</Pill>
            </div>
            <div className="text-xs text-muted-foreground">
              {fmtShare(scenario.valuationCoverage)} of rows priced · one scenario, not a total
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">No scenario is priced in this run.</div>
        )}
      </div>
      <div data-testid="tile-leading" className={TILE}>
        <div className={LABEL}>Leading indicators</div>
        {missing("indicators") ? (
          <PartMissing part="indicators" />
        ) : (
          <>
            <div className="font-mono text-3xl font-semibold tabular-nums">
              {fmtCount(leading.breaching)} <span className="text-base font-normal text-muted-foreground">of {fmtCount(leading.computed)}</span>
            </div>
            <div className="text-sm">{leading.breaching === 1 ? "indicator is" : "indicators are"} breaching</div>
            {leading.earliest !== "" && <div className="text-xs text-muted-foreground">first breach {leading.earliest}</div>}
          </>
        )}
      </div>
    </div>
  );
}
