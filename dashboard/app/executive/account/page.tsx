import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Pill } from "@/components/common";
import { AccountLookup } from "@/components/executive/account-lookup";
import { Crumbs } from "@/components/executive/crumbs";
import { PageFrame } from "@/components/executive/page-frame";
import { RecordsTable } from "@/components/executive/records-table";
import { ScoreTrio } from "@/components/executive/score-trio";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { StoreMissing } from "@/components/shell/store-missing";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadAccount } from "@/lib/data";
import { BLANK, accountHref, fmtCount, fmtScore, parseResult, traceHref } from "@/lib/executive";
import type { RecordFilter } from "@/lib/executive-types";

export const metadata: Metadata = { title: "Account" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function AccountPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountContent searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold">{children}</h2>;
}

async function AccountContent({ searchParams }: Props) {
  const q = await searchParams;
  const id = (one(q.id) ?? "").trim();
  const pageText = one(q.page);
  const filter: RecordFilter = {
    domain: one(q.domain) || undefined,
    result: parseResult(one(q.result)),
    finding: one(q.finding) || undefined,
    page: pageText !== undefined && /^\d+$/.test(pageText) ? Number(pageText) : undefined,
  };
  const result = await loadAccount(id, filter);
  if (!result.ok) return <StoreMissing file={result.file} />;
  if (result.data === null) {
    return (
      <PageFrame spacing="space-y-4">
        <h1 className="text-2xl font-semibold">Not a scored account</h1>
        <p className="text-sm text-muted-foreground">
          This ID is empty or is not an account the scorecard scores. Try another, or{" "}
          <Link href="/executive" className="text-brand-line underline-offset-2 hover:underline">go back to the executive view</Link>.
        </p>
        <AccountLookup />
      </PageFrame>
    );
  }
  const { account, scored, records, inherited } = result.data;
  const hrefFor = (f: RecordFilter) => accountHref(account.accountId, f);
  const chip = "inline-flex items-center rounded-full border px-3 py-1 text-sm hover:bg-muted";
  const active = "border-brand-line font-semibold text-brand-line";
  return (
    <PageFrame spacing="space-y-6">
      <header className="space-y-2">
        <Crumbs items={[{ label: "Executive view", href: "/executive" }, { label: "Account" }]} />
        <h1 className="flex flex-wrap items-center gap-3 font-mono text-2xl font-semibold">
          <span className="min-w-0 break-all">{account.accountId}</span>
          {account.inMaster ? (
            <Pill tone="ok" className="font-sans">in the account master</Pill>
          ) : (
            <Pill tone="bad" className="font-sans">not in the account master</Pill>
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          Fund <span className="font-mono">{account.fundId || BLANK}</span> · share class{" "}
          <span className="font-mono">{account.shareClass || BLANK}</span> · rank {fmtCount(account.rank)} of {fmtCount(scored)}
        </p>
        <ScoreTrio trio={account} size="lg" />
        <p className="text-sm text-muted-foreground">
          Alternatives to the score above: NAV-weighted{" "}
          <span className="font-mono tabular-nums text-foreground">{fmtScore(account.navProximity)}</span> · weakest link{" "}
          <span className="font-mono tabular-nums text-foreground">{fmtScore(account.weakestLink)}</span>
        </p>
        <p className="text-sm">
          <Link href={traceHref(account.accountId)} className="text-brand-line underline-offset-2 hover:underline">
            Trace this account
          </Link>
        </p>
      </header>
      <section className="space-y-2">
        <Heading>Scores by domain</Heading>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Coverage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {account.domains.map((d) => (
              <TableRow key={d.domain} data-testid="account-domain-row">
                <TableCell>{d.domain}</TableCell>
                {d.score === null && d.coverage === null ? (
                  <TableCell colSpan={2} className="text-muted-foreground">not applicable</TableCell>
                ) : (
                  <>
                    <TableCell className="font-mono tabular-nums">{fmtScore(d.score)}</TableCell>
                    <TableCell className="font-mono tabular-nums">{fmtScore(d.coverage)}</TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-sm text-muted-foreground">
          Fund NAV result: {account.fundNavResult || BLANK} (shown beside the score, never inside it)
        </p>
      </section>
      <section className="space-y-3">
        <Heading>Records</Heading>
        {!inherited && (
          <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            Records an account inherits through its holdings need a rebuilt store.
          </p>
        )}
        <nav aria-label="Filter by domain" className="flex flex-wrap gap-2">
          <Link
            href={accountHref(account.accountId)} aria-current={filter.domain === undefined ? "true" : undefined}
            className={`${chip} ${filter.domain === undefined ? active : ""}`}
          >
            All domains
          </Link>
          {records.domains.map((d) => (
            <Link
              key={d} href={accountHref(account.accountId, { domain: d })}
              aria-current={filter.domain === d ? "true" : undefined} className={`${chip} ${filter.domain === d ? active : ""}`}
            >
              {d}
            </Link>
          ))}
        </nav>
        <RecordsTable page={records} hrefFor={hrefFor} filter={filter} showDomain showHolding />
      </section>
    </PageFrame>
  );
}
