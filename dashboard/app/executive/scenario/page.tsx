import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { RegisterStatus } from "@/components/common";
import { Crumbs } from "@/components/executive/crumbs";
import { ImpactTable } from "@/components/executive/impact-table";
import { PageFrame } from "@/components/executive/page-frame";
import { Pager } from "@/components/executive/pager";
import { ScenarioCaption } from "@/components/executive/scenario-caption";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { StoreMissing } from "@/components/shell/store-missing";
import { loadScenario } from "@/lib/data";
import { BLANK, executiveHref, fmtBps, fmtCount, fmtShare, fmtUsd, scenarioHref } from "@/lib/executive";

export const metadata: Metadata = { title: "Impact scenario" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function ScenarioPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ScenarioContent searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function ScenarioContent({ searchParams }: Props) {
  const q = await searchParams;
  const name = one(q.name) ?? "";
  const priced = one(q.priced) === "yes" || one(q.priced) === "no" ? (one(q.priced) as "yes" | "no") : undefined;
  const pageText = one(q.page);
  const result = await loadScenario(name, {
    priced, page: pageText !== undefined && /^\d+$/.test(pageText) ? Number(pageText) : undefined,
  });
  if (!result.ok) return <StoreMissing file={result.file} />;
  if (result.data === null) {
    return (
      <PageFrame spacing="space-y-3">
        <h1 className="text-2xl font-semibold">No such impact scenario</h1>
        <p className="text-sm text-muted-foreground">
          <Link href={executiveHref({ by: "dollars" })} className="text-brand-line underline-offset-2 hover:underline">Back to the executive view</Link>
        </p>
      </PageFrame>
    );
  }
  const { scenario: s, records } = result.data;
  const facts: [string, string][] = [
    ["Rows", fmtCount(s.financialRows)],
    ["Valued rows", fmtCount(s.valuedRows)],
    ["Unknown rows", fmtCount(s.unknownRows)],
    ["Share priced", fmtShare(s.valuationCoverage)],
    ["Gross USD", fmtUsd(s.grossUsd)],
    ["Signed USD", fmtUsd(s.signedUsd)],
    ["Largest fund effect", fmtBps(s.maxFundNetBps)],
    ["Accounts", fmtCount(s.distinctAccounts)],
    ["Funds", fmtCount(s.affectedFunds)],
  ];
  const chip = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm hover:bg-muted";
  const active = "border-brand-line font-semibold text-brand-line";
  const chips: { label: string; count: number | null; value: "yes" | "no" | undefined }[] = [
    { label: "All", count: records.priced + records.notPriced, value: undefined },
    { label: "Priced", count: records.priced, value: "yes" },
    { label: "Not priced", count: records.notPriced, value: "no" },
  ];
  return (
    <PageFrame spacing="space-y-6">
      <header className="space-y-2">
        <Crumbs items={[{ label: "Executive view", href: executiveHref({ by: "dollars" }) }, { label: "Impact scenario" }]} />
        <h1 className="text-2xl font-semibold break-words">{s.scenario}</h1>
        <p className="text-sm text-muted-foreground">{s.interpretation}</p>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <RegisterStatus status={s.evidence} />
          <span>Account scope: {s.accountScope || BLANK}</span>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
              <dd className="font-mono tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <ScenarioCaption />
      </header>
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Keys behind this scenario</h2>
        <nav aria-label="Filter by pricing" className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <Link
              key={c.label} href={scenarioHref(s.scenario, { priced: c.value })}
              aria-current={priced === c.value ? "true" : undefined} className={`${chip} ${priced === c.value ? active : ""}`}
            >
              {c.label} <span className="font-mono tabular-nums">{fmtCount(c.count)}</span>
            </Link>
          ))}
        </nav>
        <ImpactTable rows={records.rows} />
        <Pager
          page={records.page} pages={records.pages} total={records.total}
          hrefFor={(p) => scenarioHref(s.scenario, { priced, page: p })}
        />
      </section>
    </PageFrame>
  );
}
