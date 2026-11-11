import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BLANK, accountHref, fmtCount, fmtScore } from "@/lib/executive";
import type { WorstAccounts as Worst } from "@/lib/executive-types";
import { AccountLookup } from "./account-lookup";
import { ScoreTrio } from "./score-trio";

/** A domain's score with its coverage under it (an account's domain scores have no confirmed-only score). */
function DomainCell({ score, coverage }: { score: number | null; coverage: number | null }) {
  if (score === null && coverage === null) return <span className="text-xs text-muted-foreground">not applicable</span>;
  return (
    <>
      <div className="font-mono tabular-nums">{fmtScore(score)}</div>
      <div className="text-xs whitespace-nowrap text-muted-foreground">coverage {fmtScore(coverage)}</div>
    </>
  );
}

/** The lowest-scoring accounts, the domains each is scored on, and a lookup for any other account. */
export function WorstAccounts({ worst }: { worst: Worst }) {
  const domains = [...new Set(worst.rows.flatMap((r) => r.domains.map((d) => d.domain)))];
  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Score, coverage, confirmed only</TableHead>
            {/* Headers wrap, so the domain columns (score over coverage) and the NAV result fit beside each other. */}
            {domains.map((d) => <TableHead key={d} className="whitespace-normal">{d}</TableHead>)}
            <TableHead className="whitespace-normal">Fund NAV result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {worst.rows.map((r) => (
            <TableRow key={r.accountId} data-testid="worst-account-row">
              <TableCell className="font-mono tabular-nums">{fmtCount(r.rank)}</TableCell>
              <TableCell>
                <Link href={accountHref(r.accountId)} className="font-mono text-brand-line underline-offset-2 hover:underline">
                  {r.accountId}
                </Link>
              </TableCell>
              <TableCell><ScoreTrio trio={r} /></TableCell>
              {domains.map((d) => {
                const cell = r.domains.find((x) => x.domain === d);
                return (
                  <TableCell key={d} data-domain={d}>
                    <DomainCell score={cell?.score ?? null} coverage={cell?.coverage ?? null} />
                  </TableCell>
                );
              })}
              <TableCell className="whitespace-normal text-muted-foreground">{r.fundNavResult || BLANK}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {worst.tiedBeyond > 0 && (
        <p className="text-xs text-muted-foreground">
          {fmtCount(worst.tiedBeyond)} more accounts share the last row&apos;s score
        </p>
      )}
      <AccountLookup />
    </div>
  );
}
