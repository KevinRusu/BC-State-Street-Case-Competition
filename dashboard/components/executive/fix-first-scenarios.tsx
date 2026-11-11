"use client";

import { useState } from "react";
import Link from "next/link";
import { RegisterStatus } from "@/components/common";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtBps, fmtCount, fmtShare, fmtUsd, scenarioHref, splitScenarios } from "@/lib/executive";
import type { Num, Scenario } from "@/lib/executive-types";
import { ScenarioCaption } from "./scenario-caption";

type Key = "grossUsd" | "signedUsd" | "maxFundNetBps" | "valuationCoverage" | "distinctAccounts" | "affectedFunds";

const COLUMNS: { key: Key; label: string; show: (s: Scenario) => string }[] = [
  { key: "grossUsd", label: "Gross USD", show: (s) => fmtUsd(s.grossUsd) },
  { key: "signedUsd", label: "Signed USD", show: (s) => fmtUsd(s.signedUsd) },
  { key: "maxFundNetBps", label: "Largest fund effect", show: (s) => fmtBps(s.maxFundNetBps) },
  { key: "valuationCoverage", label: "Share priced", show: (s) => fmtShare(s.valuationCoverage) },
  { key: "distinctAccounts", label: "Accounts", show: (s) => fmtCount(s.distinctAccounts) },
  { key: "affectedFunds", label: "Funds", show: (s) => fmtCount(s.affectedFunds) },
];

/** Numbers with a blank last in both directions. */
function compare(a: Num, b: Num, direction: "asc" | "desc"): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return direction === "asc" ? a - b : b - a;
}

function Name({ s }: { s: Scenario }) {
  return (
    <TableCell className="whitespace-normal">
      <Link href={scenarioHref(s.scenario)} className="text-brand-line underline-offset-2 hover:underline">{s.scenario}</Link>
      <div className="text-xs text-muted-foreground">{s.interpretation}</div>
    </TableCell>
  );
}

/** The dollar scenarios in three groups; scenarios overlap and are never added up. Only the priced group is sortable. */
export function FixFirstScenarios({ scenarios }: { scenarios: Scenario[] }) {
  const [sort, setSort] = useState<{ by: Key; direction: "asc" | "desc" } | null>(null);
  const { priced, notPriced, noRecords } = splitScenarios(scenarios);
  const pricedRows = sort
    ? [...priced].sort((a, b) => compare(a[sort.by], b[sort.by], sort.direction) || a.scenario.localeCompare(b.scenario, "en"))
    : priced;
  const click = (key: Key) =>
    setSort((s) => (s && s.by === key ? { by: key, direction: s.direction === "asc" ? "desc" : "asc" } : { by: key, direction: "asc" }));
  return (
    <div className="space-y-4">
      {priced.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scenario</TableHead>
              <TableHead>Evidence</TableHead>
              {COLUMNS.map((c) => (
                <TableHead key={c.key} aria-sort={sort?.by === c.key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => click(c.key)} className="font-medium hover:underline">
                    {c.label}
                    {sort?.by === c.key && <span aria-hidden>{sort.direction === "asc" ? " ▲" : " ▼"}</span>}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pricedRows.map((s) => (
              <TableRow key={s.scenario} data-testid="scenario-row">
                <Name s={s} />
                <TableCell><RegisterStatus status={s.evidence} /></TableCell>
                {COLUMNS.map((c) => <TableCell key={c.key} className="font-mono tabular-nums">{c.show(s)}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {notPriced.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Not priced: unknown, not zero</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scenario</TableHead>
                <TableHead>Evidence</TableHead>
                {COLUMNS.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {notPriced.map((s) => (
                <TableRow key={s.scenario} data-testid="scenario-row">
                  <Name s={s} />
                  <TableCell><RegisterStatus status={s.evidence} /></TableCell>
                  {COLUMNS.map((c) => <TableCell key={c.key} className="font-mono tabular-nums">{c.show(s)}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {noRecords.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">No records in this run</h3>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Scenario</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {noRecords.map((s) => (
                <TableRow key={s.scenario} data-testid="scenario-row"><Name s={s} /></TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <ScenarioCaption />
    </div>
  );
}
