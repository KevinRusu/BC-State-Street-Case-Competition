"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BLANK, defaultRuleOrder, executiveHref, fmtCount, fmtScore, ruleHref, rulePriorityRanks, sortRules, type RuleSort } from "@/lib/executive";
import type { RuleScore, TestScore } from "@/lib/executive-types";
import { cn } from "@/lib/utils";
import { RANKED_PREVIEW_ROWS, RankedListToggle } from "./ranked-list-toggle";

/** A header that sorts the list: clicking it again flips the direction. */
function SortHeader({ column, label, sort, onSort }: {
  column: RuleSort; label: string; sort: { by: RuleSort; direction: "asc" | "desc" } | null; onSort: (c: RuleSort) => void;
}) {
  const numeric = column === "score" || column === "coverage" || column === "confirmedOnly";
  return (
    <TableHead className={cn(numeric && "text-right")} aria-sort={sort?.by === column ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(column)} className="rounded font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {label}
        {sort?.by === column && <span aria-hidden>{sort.direction === "asc" ? " ▲" : " ▼"}</span>}
      </button>
    </TableHead>
  );
}

/**
 * One line per test, each in its own unit kind: counts of different tests are never added together. When the rule has
 * several tests, each line starts with its test ID so two alike lines stay apart.
 */
function whatFailed(t: TestScore, several: boolean): string {
  const parts = [
    [t.failedConfirmed, "confirmed"],
    [t.failedUnresolved, "unresolved"],
    [t.notEvaluable, "not evaluable"],
  ] as const;
  const shown = parts.filter(([n]) => n !== null && n !== 0).map(([n, label]) => `${fmtCount(n)} ${label}`);
  const line = shown.length ? `${t.unitKind}: ${shown.join(", ")}` : `${t.unitKind}: nothing failed`;
  return several ? `${t.test} · ${line}` : line;
}

/** The scored rules, lowest score first; the domain filter comes from the address, the column sort is local. */
export function FixFirstRules({ rules, by, domain }: { rules: RuleScore[]; by: "score" | "dollars"; domain?: string }) {
  const [sort, setSort] = useState<{ by: RuleSort; direction: "asc" | "desc" } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const tableId = useId();
  const filtered = domain ? rules.filter((r) => r.domain === domain) : rules;
  const rows = sort ? sortRules(filtered, sort.by, sort.direction) : defaultRuleOrder(filtered);
  const rankBy = sort?.by ?? "score";
  const ranks = rulePriorityRanks(rows, rankBy);
  const rankLabel = { name: "rule name", domain: "domain", score: "quality score", coverage: "coverage", confirmedOnly: "confirmed-only score", owner: "owner" }[rankBy];
  const textSort = rankBy === "name" || rankBy === "domain" || rankBy === "owner";
  const rankDirection = textSort ? (sort?.direction === "desc" ? "Z to A" : "A to Z") : (sort?.direction === "desc" ? "highest first" : "lowest first");
  const click = (key: RuleSort) =>
    setSort((s) => (s && s.by === key ? { by: key, direction: s.direction === "asc" ? "desc" : "asc" } : { by: key, direction: "asc" }));
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Ranked by {rankLabel}, {rankDirection}{domain ? " in this domain" : ""}. Ranks update with the selected column and direction; unavailable values are unranked.
      </p>
      {domain && (
        <p className="text-sm text-muted-foreground">
          Showing {domain} only.{" "}
          <Link href={`${executiveHref({ by })}#fix-first`} className="text-brand-line underline-offset-2 hover:underline">Show all domains</Link>
        </p>
      )}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No scored rule in this domain</p>
      ) : (
        <div id={tableId} className="rounded-xl border">
          <Table className="[&_td]:px-3 [&_td]:py-3 [&_th]:px-3">
            <TableHeader>
              <TableRow className="bg-block">
                <TableHead className="w-14 text-center" aria-sort={sort === null ? "ascending" : "none"}>
                  <button type="button" onClick={() => setSort(null)} title="Restore lowest-score priority order" className="rounded font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    Rank{sort === null && <span aria-hidden> ▲</span>}
                  </button>
                </TableHead>
                <SortHeader column="name" label="Rule" sort={sort} onSort={click} />
                <SortHeader column="domain" label="Domain" sort={sort} onSort={click} />
                <SortHeader column="score" label="Score" sort={sort} onSort={click} />
                <SortHeader column="coverage" label="Coverage" sort={sort} onSort={click} />
                <SortHeader column="confirmedOnly" label="Confirmed only" sort={sort} onSort={click} />
                <TableHead>What failed</TableHead>
                <SortHeader column="owner" label="Owner" sort={sort} onSort={click} />
                <TableHead>Action on fail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(expanded ? rows : rows.slice(0, RANKED_PREVIEW_ROWS)).map((r) => (
                <TableRow key={`${r.domain}/${r.rule}`} data-testid="rule-row">
                  <TableCell data-testid="priority-rank" className="text-center font-mono font-semibold tabular-nums">
                    <span className="inline-flex min-w-7 items-center justify-center rounded-md bg-muted px-1.5 py-1">{ranks.get(r) ?? BLANK}</span>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <Link href={ruleHref(r.domain, r.rule)} className="text-brand-line underline-offset-2 hover:underline">{r.name}</Link>
                    <div className="font-mono text-xs text-muted-foreground">{r.rule}</div>
                  </TableCell>
                  <TableCell data-testid="rule-domain">{r.domain}</TableCell>
                  <TableCell data-testid="score" className="text-right font-mono font-semibold tabular-nums">{fmtScore(r.score)}</TableCell>
                  <TableCell data-testid="coverage" className="text-right font-mono tabular-nums">{fmtScore(r.coverage)}</TableCell>
                  <TableCell data-testid="confirmed-only" className="text-right font-mono tabular-nums">{fmtScore(r.confirmedOnly)}</TableCell>
                  <TableCell data-testid="what-failed" className="text-xs whitespace-normal">
                    {r.tests.length === 0 ? BLANK : r.tests.map((t) => <div key={t.test}>{whatFailed(t, r.tests.length > 1)}</div>)}
                  </TableCell>
                  <TableCell data-testid="rule-owner" className="text-muted-foreground whitespace-normal">{r.owner}</TableCell>
                  <TableCell className="text-xs whitespace-normal">{r.onFail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <RankedListToggle rowCount={rows.length} expanded={expanded} controls={tableId} onToggle={() => setExpanded(!expanded)} />
    </div>
  );
}
