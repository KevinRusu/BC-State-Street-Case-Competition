"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { RegisterStatus } from "@/components/common";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtBps, fmtCount, fmtShare, fmtUsd, scenarioHref, splitScenarios } from "@/lib/executive";
import type { Num, Scenario } from "@/lib/executive-types";
import { DetailDisclosure } from "./detail-disclosure";
import { RANKED_PREVIEW_ROWS, RankedListToggle } from "./ranked-list-toggle";
import { ScenarioCaption } from "./scenario-caption";

type Key = "grossUsd" | "signedUsd" | "maxFundNetBps" | "valuationCoverage" | "distinctAccounts" | "affectedFunds";
type Sort = { by: Key; direction: "asc" | "desc" };
const COLUMNS: { key: Key; label: string; show: (s: Scenario) => string }[] = [
  { key: "grossUsd", label: "Gross USD", show: (s) => fmtUsd(s.grossUsd) },
  { key: "signedUsd", label: "Signed USD", show: (s) => fmtUsd(s.signedUsd) },
  { key: "maxFundNetBps", label: "Largest fund effect", show: (s) => fmtBps(s.maxFundNetBps) },
  { key: "valuationCoverage", label: "Share priced", show: (s) => fmtShare(s.valuationCoverage) },
  { key: "distinctAccounts", label: "Accounts", show: (s) => fmtCount(s.distinctAccounts) },
  { key: "affectedFunds", label: "Funds", show: (s) => fmtCount(s.affectedFunds) },
];

/** Numbers with a blank last in both directions. */
function compare(a: Num, b: Num, direction: Sort["direction"]): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return direction === "asc" ? a - b : b - a;
}

function Name({ scenario }: { scenario: Scenario }) {
  return (
    <TableCell className="min-w-44 whitespace-normal">
      <Link href={scenarioHref(scenario.scenario)} className="font-medium text-brand-line underline-offset-2 hover:underline">
        {scenario.scenario}
      </Link>
      {scenario.interpretation && (
        <DetailDisclosure label="Description" accessibleLabel={`Description for ${scenario.scenario}`}>
          <p className="text-xs text-muted-foreground">{scenario.interpretation}</p>
        </DetailDisclosure>
      )}
    </TableCell>
  );
}

function ScenarioTable({ rows, sort, onSort }: { rows: Scenario[]; sort?: Sort | null; onSort?: (key: Key) => void }) {
  return (
    <div className="rounded-xl border">
      <Table className="[&_td]:px-3 [&_td]:py-3 [&_th]:px-3">
        <TableHeader>
          <TableRow className="bg-block">
            <TableHead>Scenario</TableHead>
            <TableHead>Evidence</TableHead>
            {COLUMNS.map((column) => (
              <TableHead
                key={column.key}
                className="text-right"
                aria-sort={onSort ? sort?.by === column.key ? sort.direction === "asc" ? "ascending" : "descending" : "none" : undefined}
              >
                {onSort ? (
                  <button type="button" onClick={() => onSort(column.key)} className="rounded font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    {column.label}
                    {sort?.by === column.key && <span aria-hidden>{sort.direction === "asc" ? " ▲" : " ▼"}</span>}
                  </button>
                ) : column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((scenario) => (
            <TableRow key={scenario.scenario} data-testid="scenario-row">
              <Name scenario={scenario} />
              <TableCell><RegisterStatus status={scenario.evidence} /></TableCell>
              {COLUMNS.map((column) => <TableCell key={column.key} className="text-right font-mono tabular-nums">{column.show(scenario)}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** The dollar scenarios in three groups. Only the priced group is sortable. */
export function FixFirstScenarios({ scenarios }: { scenarios: Scenario[] }) {
  const [sort, setSort] = useState<Sort | null>(null);
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const { priced, notPriced, noRecords } = splitScenarios(scenarios);
  const pricedRows = sort
    ? [...priced].sort((a, b) => compare(a[sort.by], b[sort.by], sort.direction) || a.scenario.localeCompare(b.scenario, "en"))
    : priced;
  const limit = expanded ? scenarios.length : RANKED_PREVIEW_ROWS;
  const shownPriced = pricedRows.slice(0, limit);
  const shownNotPriced = notPriced.slice(0, limit - shownPriced.length);
  const shownEmpty = noRecords.slice(0, limit - shownPriced.length - shownNotPriced.length);

  function changeSort(key: Key) {
    setSort((current) => ({
      by: key,
      direction: current?.by === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  return (
    <div className="space-y-3">
      <div id={listId} className="space-y-4">
        {shownPriced.length > 0 && <ScenarioTable rows={shownPriced} sort={sort} onSort={changeSort} />}
        {shownNotPriced.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Not priced: unknown, not zero</h3>
            <ScenarioTable rows={shownNotPriced} />
          </div>
        )}
        {shownEmpty.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">No records in this run</h3>
            <div className="rounded-xl border">
              <Table className="[&_td]:px-3 [&_td]:py-3 [&_th]:px-3">
                <TableHeader>
                  <TableRow className="bg-block"><TableHead>Scenario</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {shownEmpty.map((scenario) => (
                    <TableRow key={scenario.scenario} data-testid="scenario-row"><Name scenario={scenario} /></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
      <RankedListToggle rowCount={scenarios.length} expanded={expanded} controls={listId} onToggle={() => setExpanded(!expanded)} />
      <ScenarioCaption />
    </div>
  );
}
