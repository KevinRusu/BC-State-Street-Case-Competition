"use client";

import Link from "next/link";
import { executiveHref } from "@/lib/executive";
import type { RuleScore, Scenario } from "@/lib/executive-types";
import { cn } from "@/lib/utils";
import { FixFirstRules } from "./fix-first-rules";
import { FixFirstScenarios } from "./fix-first-scenarios";
import { PartMissing } from "./part-missing";

/** One switch, two lists: rules by lowest quality score, or scenarios by largest dollars. Nothing is merged or summed. */
export function FixFirst({ rules, scenarios, by, domain, impactMissing, scorecardMissing }: {
  rules: RuleScore[]; scenarios: Scenario[]; by: "score" | "dollars"; domain?: string; impactMissing: boolean; scorecardMissing: boolean;
}) {
  const tabs = [
    { by: "dollars", label: "By dollar impact" },
    { by: "score", label: "By quality score" },
  ] as const;
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Order of the fix-first list" className="inline-flex rounded-lg border p-0.5 text-sm">
        {tabs.map((t) => (
          <Link
            key={t.by}
            role="tab"
            aria-selected={by === t.by}
            href={executiveHref({ by: t.by, domain })}
            scroll={false}
            className={cn("rounded-md px-3 py-1", by === t.by ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {by === "dollars" ? (
        impactMissing ? <PartMissing part="impact" /> : <FixFirstScenarios scenarios={scenarios} />
      ) : scorecardMissing ? (
        <PartMissing part="scorecard" />
      ) : (
        <FixFirstRules rules={rules} by={by} domain={domain} />
      )}
    </div>
  );
}
