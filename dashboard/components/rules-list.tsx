import { RegisterStatus } from "@/components/common";
import { fmt } from "@/lib/status";
import type { RegisterLine, RuleText } from "@/lib/types";

/** Each rule (text from docs/RULES.md) with the lines the deliverable notebook's register holds for it. */
export function RulesList({ ruleIds, catalog, register }: { ruleIds: string[]; catalog: RuleText[]; register: RegisterLine[] }) {
  if (!ruleIds.length) return <p className="text-sm text-muted-foreground">No rule sits here yet.</p>;
  return (
    <div className="space-y-3">
      {ruleIds.map((ruleId) => {
        const rule = catalog.find((r) => r.ruleId === ruleId);
        const lines = register.filter((r) => r.ruleId === ruleId);
        return (
          <div key={ruleId} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold">{ruleId}</span>
              {rule?.onFail && <span className="text-[11px] text-muted-foreground">on fail: {rule.onFail}</span>}
            </div>
            {rule && <p className="text-xs leading-relaxed text-muted-foreground">{rule.test}</p>}
            {lines.length ? (
              <ul className="space-y-1.5">
                {lines.map((line) => (
                  <li key={line.line} className="flex items-start justify-between gap-2 text-xs">
                    <span className="flex items-start gap-2">
                      <RegisterStatus status={line.status} />
                      <span>{line.finding}</span>
                    </span>
                    <span className="shrink-0 font-mono tabular-nums">
                      {fmt(line.affected)} {line.unit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No line in this run&apos;s register.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
