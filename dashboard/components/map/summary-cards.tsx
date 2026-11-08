import { Dot } from "@/components/common";
import { totals } from "@/lib/findings";
import { REGISTER_STATUS } from "@/lib/status";
import type { RegisterLine } from "@/lib/types";

// Wording from docs/RULES.md, "Evidence status for every finding".
const CARDS = [
  { status: "confirmed", label: "Confirmed", meaning: "the data proves it" },
  { status: "unresolved", label: "Unresolved", meaning: "fails a test, not yet proven" },
  { status: "cleared", label: "Cleared", meaning: "looked wrong, turned out fine" },
] as const;

/** The deliverable notebook's register lines by evidence status: every one of them counts once somewhere on the map. */
export function SummaryCards({ register }: { register: RegisterLine[] }) {
  const counts = totals(register);
  return (
    <div className="grid grid-cols-3 gap-3">
      {CARDS.map(({ status, label, meaning }) => (
        <div key={status} className="rounded-2xl bg-block px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Dot tone={REGISTER_STATUS[status]} />
            {label}
          </div>
          <div className="mt-0.5 text-2xl font-semibold tabular-nums">{counts[status]}</div>
          <div className="text-xs text-muted-foreground">{meaning}</div>
        </div>
      ))}
    </div>
  );
}
