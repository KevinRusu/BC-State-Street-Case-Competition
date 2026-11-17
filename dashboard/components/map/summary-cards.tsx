"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Dot } from "@/components/common";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { summaryOf } from "@/lib/findings";
import { REGISTER_STATUS } from "@/lib/status";
import type { RegisterLine } from "@/lib/types";

// Wording from docs/RULES.md, "Evidence status for every finding". Cleared means a false alarm we ruled out, so it
// sits beside the real problems, never under them (D-075).
const PROBLEMS = [
  { status: "confirmed", label: "Confirmed", meaning: "the data proves it" },
  { status: "unresolved", label: "Unresolved", meaning: "fails a test, not yet proven" },
] as const;

/**
 * The deliverable notebook's register lines in two groups, real problems and false alarms ruled out: every line
 * counts once somewhere on the map.
 */
export function SummaryCards({ register }: { register: RegisterLine[] }) {
  const summary = summaryOf(register);
  const [open, setOpen] = useState(false);
  return (
    // Beside the map (wide screens) the summary takes the map's height and scrolls itself, so opening the cleared
    // list never stretches the map (h-0 keeps it out of the row's height; min-h-full fills the row).
    <aside
      aria-label="Finding summary"
      className="grid grid-cols-1 content-start items-start gap-3 @min-[30rem]:grid-cols-2 @min-[52rem]:h-0 @min-[52rem]:min-h-full @min-[52rem]:grid-cols-1 @min-[52rem]:overflow-y-auto"
    >
      <div className="col-span-full flex items-baseline justify-between gap-2 px-1 text-sm">
        <span className="text-muted-foreground">Flagged by our checks</span>
        <span data-testid="summary-flagged" className="font-semibold tabular-nums">{summary.flagged}</span>
      </div>

      <div data-testid="summary-problems-card" className="min-w-0 rounded-xl border bg-block px-3 py-3 sm:px-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">Real problems</span>
          <span data-testid="summary-problems" className="text-2xl font-semibold tabular-nums">{summary.problems}</span>
        </div>
        <ul className="mt-2 space-y-2">
          {PROBLEMS.map(({ status, label, meaning }) => (
            <li key={status} className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Dot tone={REGISTER_STATUS[status]} />
                <span>{label}</span>
                <span data-testid={`summary-${status}`} className="ml-auto font-semibold tabular-nums">{summary[status]}</span>
              </div>
              <div className="pl-3.5 text-xs text-muted-foreground">{meaning}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0 rounded-xl border border-dashed px-3 py-3 sm:px-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
          <Dot tone={REGISTER_STATUS.cleared} />
          <span>False alarms ruled out</span>
          <span data-testid="summary-cleared" className="ml-auto font-semibold tabular-nums text-foreground">{summary.cleared}</span>
        </div>
        <div className="pl-3.5 text-xs text-muted-foreground">looked wrong, turned out fine (cleared)</div>
        {summary.clearedFindings.length > 0 && (
          <Collapsible open={open} onOpenChange={setOpen} className="mt-2 pl-3.5">
            <CollapsibleTrigger className="group inline-flex min-h-8 items-center gap-1 rounded-md text-xs font-medium text-brand-line hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              {open ? "Hide list" : "Show which"}
              <ChevronDown aria-hidden className="size-3.5 transition-transform group-data-[panel-open]:rotate-180 motion-reduce:transition-none" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul data-testid="summary-cleared-list" className="mt-1 list-disc space-y-1 pl-4 text-xs break-words">
                {summary.clearedFindings.map((finding, i) => <li key={i}>{finding}</li>)}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </aside>
  );
}
