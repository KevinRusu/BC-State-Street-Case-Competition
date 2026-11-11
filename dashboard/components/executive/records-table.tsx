import Link from "next/link";
import { Pill } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BLANK, accountHref, fmtCount, noTraceReason, RESULT_TONE, traceHref, traceTarget } from "@/lib/executive";
import type { OutcomeRecord, RecordFilter, RecordPage } from "@/lib/executive-types";
import { Pager } from "./pager";
import { ResultChips } from "./result-chips";

function TraceCell({ r }: { r: OutcomeRecord }) {
  const target = traceTarget(r.unitKind, r.recordId);
  if (target === null) return <span className="text-xs text-muted-foreground">{noTraceReason(r.unitKind)}</span>;
  return (
    <div>
      <Link href={traceHref(target.id)} aria-label={`Trace ${r.recordId}`} className="text-brand-line underline-offset-2 hover:underline">
        Trace
      </Link>
      {target.note !== "" && <div className="text-xs text-muted-foreground">{target.note}</div>}
    </div>
  );
}

/**
 * The listed records of a rule or an account: result chips, the finding select, the table and the pager. It knows
 * nothing of the page around it: `hrefFor` builds the address for a changed filter. The finding form keeps the
 * other current parameters as hidden fields, read back from `hrefFor`, so it works without JavaScript.
 */
export function RecordsTable({
  page, hrefFor, filter, showDomain, showHolding,
}: {
  page: RecordPage; hrefFor: (f: RecordFilter) => string; filter: RecordFilter; showDomain?: boolean; showHolding?: boolean;
}) {
  const none = { ...filter, finding: undefined, page: undefined };
  const [action, query = ""] = hrefFor(none).split("?");
  const kept = [...new URLSearchParams(query.split("#")[0]).entries()];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResultChips counts={page.counts} filter={filter} hrefFor={hrefFor} />
        {/* Keyed by the address's finding: a link that changes it (a domain chip clears it) remounts the form, so the
            uncontrolled select shows the address's finding, not the last choice. */}
        <form key={filter.finding ?? ""} method="get" action={action} className="flex flex-wrap items-center gap-2">
          {kept.map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
          <label htmlFor="finding-filter" className="text-sm text-muted-foreground">Finding</label>
          <select
            id="finding-filter" name="finding" defaultValue={filter.finding ?? ""}
            className="h-8 max-w-72 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="">All findings</option>
            {page.findings.map((f) => (
              <option key={f.finding} value={f.finding}>{f.plain || f.finding} ({fmtCount(f.rows)} rows)</option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="sm">Apply</Button>
        </form>
      </div>
      {page.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No record matches these filters.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Record</TableHead>
              {showDomain && <TableHead>Domain</TableHead>}
              <TableHead>Unit kind</TableHead>
              <TableHead>Test</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Finding</TableHead>
              <TableHead>Accounts</TableHead>
              {showHolding && <TableHead>Through holding</TableHead>}
              <TableHead>Trace</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.rows.map((r, i) => (
              <TableRow key={`${r.domain}/${r.rule}/${r.test}/${r.recordId}/${i}`} data-testid="record-row">
                <TableCell className="font-mono text-xs">{r.recordId}</TableCell>
                {showDomain && <TableCell data-testid="record-domain">{r.domain}</TableCell>}
                <TableCell>{r.unitKind}</TableCell>
                <TableCell className="font-mono text-xs">{r.test}</TableCell>
                <TableCell><Pill tone={RESULT_TONE[r.result]}>{r.result}</Pill></TableCell>
                <TableCell className="whitespace-normal" title={r.finding}>{r.plain || r.finding}</TableCell>
                <TableCell className="whitespace-normal">
                  {r.accounts.length === 0 ? (
                    BLANK
                  ) : (
                    <span className="flex flex-wrap gap-x-2">
                      {r.accounts.map((a) => (
                        <Link key={a} href={accountHref(a)} className="font-mono text-xs text-brand-line underline-offset-2 hover:underline">{a}</Link>
                      ))}
                    </span>
                  )}
                </TableCell>
                {showHolding && (
                  <TableCell className="font-mono text-xs whitespace-normal">
                    {r.holding === "" ? (
                      BLANK
                    ) : (
                      <Link href={traceHref(r.holding)} aria-label={`Trace holding ${r.holding}`} className="text-brand-line underline-offset-2 hover:underline">
                        {r.holding}
                      </Link>
                    )}
                  </TableCell>
                )}
                <TableCell className="whitespace-normal"><TraceCell r={r} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pager page={page.page} pages={page.pages} total={page.total} hrefFor={(p) => hrefFor({ ...filter, page: p })} />
    </div>
  );
}
