import { TargetAttainment } from "./target-attainment";
import { fmtScore, scoreTargetStatus } from "@/lib/executive";
import type { Num } from "@/lib/executive-types";
import { toneColor } from "@/lib/status";

export function ScoreTarget({ score, minimum, stacked = false }: { score: Num; minimum: Num; stacked?: boolean }) {
  const { tone, target } = scoreTargetStatus(score, minimum);
  const hasScore = score !== null && Number.isFinite(score) && score >= 0 && score <= 100;
  return (
    <div className={stacked ? "space-y-1" : "space-y-2"}>
      <div className={stacked ? "flex flex-col items-start gap-0.5" : "flex flex-wrap items-center justify-between gap-x-2 gap-y-1"}>
        <span data-testid="score-target-minimum" className="text-xs text-muted-foreground tabular-nums">
          {target !== null ? `Target ${fmtScore(target)}` : "Target unavailable"}
        </span>
        <TargetAttainment tone={tone} missing={hasScore ? "No target" : "No score"} />
      </div>
      <div
        data-testid="score-target-bar"
        role="img"
        aria-label={`${hasScore ? `Score ${fmtScore(score)} on a scale of 0 to 100` : "No score"}${target === null ? "" : `, target ${fmtScore(target)}`}`}
        className="relative h-2 rounded-full bg-muted"
      >
        {hasScore && (
          <div
            className="h-full min-w-1 rounded-full"
            style={{ width: `${score}%`, background: tone ? toneColor(tone) : "var(--muted-foreground)" }}
          />
        )}
        {target !== null && (
          <span className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${target}%` }} />
        )}
      </div>
    </div>
  );
}
