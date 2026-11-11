import { fmtScore } from "@/lib/executive";
import type { ScoreTrio as Trio } from "@/lib/executive-types";
import { cn } from "@/lib/utils";

/** A score with its coverage and its confirmed-only score: the three are never shown apart. */
export function ScoreTrio({ trio, size }: { trio: Trio; size?: "lg" }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <span data-testid="score" className={cn("font-mono font-semibold tabular-nums", size === "lg" ? "text-3xl" : "text-sm")}>
        {fmtScore(trio.score)}
      </span>
      <span className="text-xs whitespace-nowrap text-muted-foreground">
        <span data-testid="coverage">coverage {fmtScore(trio.coverage)}</span>
        {" · "}
        <span data-testid="confirmed-only">confirmed only {fmtScore(trio.confirmedOnly)}</span>
      </span>
    </div>
  );
}
