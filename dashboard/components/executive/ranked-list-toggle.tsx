import { ChevronDown } from "lucide-react";
import { fmtCount } from "@/lib/executive";

export const RANKED_PREVIEW_ROWS = 5;

export function RankedListToggle({ rowCount, expanded, controls, onToggle }: {
  rowCount: number; expanded: boolean; controls: string; onToggle: () => void;
}) {
  const hidden = rowCount - RANKED_PREVIEW_ROWS;
  if (hidden <= 0) return null;

  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
      className="group inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium text-brand-line hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {expanded ? "Show fewer" : `Show ${fmtCount(hidden)} more`}
      <ChevronDown aria-hidden className="size-4 transition-transform group-aria-expanded:rotate-180 motion-reduce:transition-none" />
    </button>
  );
}
