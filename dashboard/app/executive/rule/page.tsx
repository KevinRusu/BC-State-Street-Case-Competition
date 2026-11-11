import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Crumbs } from "@/components/executive/crumbs";
import { PageFrame } from "@/components/executive/page-frame";
import { RecordsTable } from "@/components/executive/records-table";
import { ScoreTrio } from "@/components/executive/score-trio";
import { TestsTable } from "@/components/executive/tests-table";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { StoreMissing } from "@/components/shell/store-missing";
import { loadRule } from "@/lib/data";
import { BLANK, executiveHref, parseResult, ruleHref } from "@/lib/executive";
import type { RecordFilter } from "@/lib/executive-types";

export const metadata: Metadata = { title: "Rule" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function RulePage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RuleContent searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold">{children}</h2>;
}

async function RuleContent({ searchParams }: Props) {
  const q = await searchParams;
  const domain = one(q.domain) ?? "";
  const ruleId = one(q.rule) ?? "";
  const pageText = one(q.page);
  const filter: RecordFilter = {
    result: parseResult(one(q.result)),
    finding: one(q.finding) || undefined,
    page: pageText !== undefined && /^\d+$/.test(pageText) ? Number(pageText) : undefined,
  };
  const result = await loadRule(domain, ruleId, filter);
  if (!result.ok) return <StoreMissing file={result.file} />;
  if (result.data === null) {
    return (
      <PageFrame spacing="space-y-3">
        <h1 className="text-2xl font-semibold">No such rule in the scorecard</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/executive" className="text-brand-line underline-offset-2 hover:underline">Back to the executive view</Link>
        </p>
      </PageFrame>
    );
  }
  const { rule, records } = result.data;
  const hrefFor = (f: RecordFilter) => ruleHref(rule.domain, rule.rule, f);
  return (
    <PageFrame spacing="space-y-6">
      <header className="space-y-2">
        <Crumbs items={[
          { label: "Executive view", href: "/executive" },
          { label: rule.domain, href: executiveHref({ domain: rule.domain }) },
          { label: rule.name },
        ]} />
        <h1 className="text-2xl font-semibold break-words">
          {rule.name} <span className="font-mono text-base font-normal break-all text-muted-foreground">{rule.rule}</span>
        </h1>
        <p className="text-sm text-muted-foreground">Owner: {rule.owner || BLANK}</p>
        <ScoreTrio trio={rule} size="lg" />
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">What it tests</dt>
            <dd>{rule.whatItTests}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Action on fail</dt>
            <dd>{rule.onFail}</dd>
          </div>
        </dl>
      </header>
      <section className="space-y-2">
        <Heading>Tests</Heading>
        <TestsTable tests={rule.tests} />
      </section>
      <section className="space-y-2">
        <Heading>Records</Heading>
        {records.total === 0 && Object.values(records.counts).every((n) => n === 0) ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Every unit of this rule passed.</p>
        ) : (
          <>
            <RecordsTable page={records} hrefFor={hrefFor} filter={filter} />
            <p className="text-sm text-muted-foreground">Passed records are counted in the tests above and not listed.</p>
          </>
        )}
      </section>
    </PageFrame>
  );
}
