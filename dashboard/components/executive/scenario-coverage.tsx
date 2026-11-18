import { fmtCount, fmtShare } from "@/lib/executive";
import type { Scenario } from "@/lib/executive-types";

export function ScenarioCoverage({ scenario }: { scenario: Scenario }) {
  const total = scenario.financialRows;
  const priced = scenario.valuedRows;
  const unpriced = scenario.unknownRows;
  // Unknown or inconsistent counts must not look like zero unpriced rows.
  if (total === null || priced === null || unpriced === null
    || ![total, priced, unpriced].every(Number.isSafeInteger)
    || total <= 0 || priced < 0 || unpriced < 0 || priced + unpriced !== total) {
    return <p className="text-xs text-muted-foreground">Valuation coverage unavailable.</p>;
  }
  const coverage = priced / total;
  return (
    <div data-testid="scenario-coverage" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-[11px]">
        <span className="text-muted-foreground">Valuation coverage</span>
        <span className="font-medium tabular-nums">{fmtShare(coverage)} priced</span>
      </div>
      <div
        role="img"
        aria-label={`Valuation coverage: ${fmtCount(priced)} of ${fmtCount(total)} rows priced; ${fmtCount(unpriced)} rows unpriced. Row coverage, not a share of financial exposure.`}
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <span aria-hidden className="h-full shrink-0 bg-brand-line" style={{ width: `${coverage * 100}%` }} />
        <span
          aria-hidden
          className="h-full shrink-0"
          style={{
            width: `${(1 - coverage) * 100}%`,
            backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 3px, color-mix(in oklab, var(--muted-foreground) 25%, transparent) 3px, color-mix(in oklab, var(--muted-foreground) 25%, transparent) 5px)",
          }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span data-testid="scenario-priced" className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-sm bg-brand-line" />
          <span className="tabular-nums">{fmtCount(priced)} priced</span>
        </span>
        <span data-testid="scenario-unpriced" className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-sm border border-muted-foreground" />
          <span className="tabular-nums">{fmtCount(unpriced)} unpriced</span>
        </span>
      </div>
    </div>
  );
}
