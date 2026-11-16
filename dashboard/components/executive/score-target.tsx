import { Pill } from "@/components/common";
import { fmtScore, scoreTargetStatus } from "@/lib/executive";
import type { Num } from "@/lib/executive-types";
import { toneColor } from "@/lib/status";

const LABELS = { ok: "Met target", warn: "Within 5% below target", bad: "Below target" };

export function ScoreTarget({ score, minimum }: { score: Num; minimum: Num }) {
  const { tone, target } = scoreTargetStatus(score, minimum);
  const hasScore = score !== null && Number.isFinite(score) && score >= 0 && score <= 100;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        {target !== null && (
          <span className="text-xs text-muted-foreground tabular-nums">Target {fmtScore(target)}</span>
        )}
        {tone ? <Pill tone={tone}>{LABELS[tone]}</Pill> : (
          <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {hasScore ? "No target" : "No score"}
          </span>
        )}
      </div>
      <div
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
