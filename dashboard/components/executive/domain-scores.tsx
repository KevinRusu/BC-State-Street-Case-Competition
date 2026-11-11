import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { executiveHref } from "@/lib/executive";
import type { DomainScore } from "@/lib/executive-types";
import { ScoreTrio } from "./score-trio";

/** One row per domain: name (a link to its rules), a bar as long as the score (none for a blank score), the score
 * trio and the owner. */
export function DomainScores({ domains }: { domains: DomainScore[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Domain</TableHead>
          <TableHead className="min-w-32"><span className="sr-only">Score bar</span></TableHead>
          <TableHead>Score, coverage, confirmed only</TableHead>
          <TableHead>Owner</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {domains.map((d) => (
          <TableRow key={d.domain} data-testid="domain-row">
            <TableCell>
              <Link href={executiveHref({ domain: d.domain })} className="text-brand-line underline-offset-2 hover:underline">
                {d.domain}
              </Link>
            </TableCell>
            <TableCell aria-hidden>
              {d.score !== null && (
                <div className="h-2 w-full min-w-24 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(Math.max(d.score, 0), 100)}%` }} />
                </div>
              )}
            </TableCell>
            <TableCell><ScoreTrio trio={d} /></TableCell>
            <TableCell className="text-muted-foreground">{d.owner}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
