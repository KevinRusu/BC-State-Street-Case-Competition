import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BLANK, accountHref, fmtNumber, fmtUsd, impactTraceTarget, traceHref } from "@/lib/executive";
import type { ImpactRecord } from "@/lib/executive-types";

/** The keys behind one impact scenario, each with its dollar figure ("not priced" when it has none). */
export function ImpactTable({ rows }: { rows: ImpactRecord[] }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No row matches this filter.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account</TableHead>
          <TableHead>Security</TableHead>
          <TableHead>Fund</TableHead>
          <TableHead>Change in units</TableHead>
          <TableHead>Change in USD</TableHead>
          <TableHead>Valuation reason</TableHead>
          <TableHead>Trace</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => {
          const target = impactTraceTarget(r);
          return (
            <TableRow key={`${r.accountId}/${r.securityId}/${r.ledgerId}/${i}`} data-testid="impact-row">
              <TableCell>
                {r.accountId === "" ? (
                  BLANK
                ) : (
                  <Link href={accountHref(r.accountId)} className="font-mono text-xs text-brand-line underline-offset-2 hover:underline">
                    {r.accountId}
                  </Link>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">{r.securityId || BLANK}</TableCell>
              <TableCell className="font-mono text-xs">{r.fundId || BLANK}</TableCell>
              <TableCell data-testid="delta-units" className="font-mono tabular-nums">{fmtNumber(r.deltaUnits)}</TableCell>
              <TableCell className="font-mono tabular-nums">{fmtUsd(r.deltaUsd)}</TableCell>
              <TableCell className="whitespace-normal">{r.valuationReason || BLANK}</TableCell>
              <TableCell>
                {target === null ? (
                  BLANK
                ) : (
                  <Link href={traceHref(target)} aria-label={`Trace ${target}`} className="text-brand-line underline-offset-2 hover:underline">
                    Trace
                  </Link>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
