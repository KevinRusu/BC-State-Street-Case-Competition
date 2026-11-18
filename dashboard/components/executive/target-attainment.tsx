import { Pill } from "@/components/common";

/** Same visual rulings for domain scores and office KPIs, including the existing 5% near-target band. */
export function TargetAttainment({ tone, missing = "Not assessed" }: { tone: "ok" | "warn" | "bad" | null; missing?: string }) {
  return (
    <span data-testid="target-attainment" className="inline-flex min-h-6 items-center"
      title={tone === "warn" ? "Target missed by no more than 5% of its threshold, in the failing direction." : undefined}>
      {tone ? <Pill tone={tone}>{tone === "ok" ? "Met target" : tone === "warn" ? "Near target" : "Missed target"}</Pill> : (
        <span className="text-xs text-muted-foreground">{missing}</span>
      )}
    </span>
  );
}
