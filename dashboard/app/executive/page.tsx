import { Suspense } from "react";
import type { Metadata } from "next";
import { DomainScores } from "@/components/executive/domain-scores";
import { FixFirst } from "@/components/executive/fix-first";
import { HeadlineTiles } from "@/components/executive/headline-tiles";
import { IndicatorCards } from "@/components/executive/indicator-cards";
import { KpiTable } from "@/components/executive/kpi-table";
import { PartMissing } from "@/components/executive/part-missing";
import { TrustSection } from "@/components/executive/trust-section";
import { WorstAccounts } from "@/components/executive/worst-accounts";
import { PageFrame } from "@/components/executive/page-frame";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { StoreMissing } from "@/components/shell/store-missing";
import { loadExecutive } from "@/lib/data";

export const metadata: Metadata = { title: "Executive view" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function ExecutivePage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ExecutiveContent searchParams={searchParams} />
    </Suspense>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold tracking-tight">{children}</h2>;
}

async function ExecutiveContent({ searchParams }: Props) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const by = one(q.by) === "dollars" ? "dollars" : "score";
  const domain = one(q.domain) || undefined;
  const result = await loadExecutive();
  if (!result.ok) return <StoreMissing file={result.file} />;
  const data = result.data;
  const missing = (p: (typeof data.missing)[number]) => data.missing.includes(p);
  return (
    <PageFrame spacing="space-y-7 md:space-y-9">
        <h1 className="text-2xl font-semibold tracking-tight">Executive view</h1>
        <HeadlineTiles data={data} />
        <section id="degrading" className="space-y-5">
          <Heading>Platform Degradation</Heading>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Domains</h3>
            {missing("scorecard") ? <PartMissing part="scorecard" /> : <DomainScores domains={data.domains} />}
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Indicators</h3>
            {missing("indicators") ? <PartMissing part="indicators" /> : <IndicatorCards indicators={data.indicators} />}
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">KPIs by Office</h3>
            {missing("kpis") ? <PartMissing part="kpis" /> : <KpiTable kpis={data.kpis} />}
          </div>
          <div className="space-y-2" data-testid="worst-accounts">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Worst Accounts</h3>
            {missing("accounts") ? <PartMissing part="accounts" /> : <WorstAccounts worst={data.worst} />}
          </div>
        </section>
        <section id="fix-first" className="space-y-4 border-t pt-5">
          <Heading>Platform Repair Triage</Heading>
          <FixFirst
            rules={data.rules} scenarios={data.scenarios} by={by} domain={domain}
            impactMissing={missing("impact")} scorecardMissing={missing("scorecard")}
          />
        </section>
        <section id="trust" className="space-y-4 border-t pt-5">
          <Heading>Data Integrity Status</Heading>
          <TrustSection
            stress={data.stress} sensitivity={data.sensitivity} platformScore={data.platform?.score ?? null}
            missing={data.missing}
          />
        </section>
    </PageFrame>
  );
}
