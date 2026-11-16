import { ChevronDown } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

function ExecutiveSection({ id, title, collapsible = false, children }: {
  id: string; title: string; collapsible?: boolean; children: React.ReactNode;
}) {
  const headingId = `${id}-heading`;
  const headingClass = "text-lg font-semibold tracking-tight md:text-xl";
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="relative scroll-mt-6 space-y-4 border-t border-muted-foreground/40 pt-5 before:pointer-events-none before:absolute before:-top-px before:left-0 before:h-0.5 before:w-10 before:rounded-full before:bg-brand-line/90 md:space-y-5 md:pt-6"
    >
      {collapsible ? (
        <Collapsible defaultOpen={false}>
          <h2 id={headingId} className={headingClass}>
            <CollapsibleTrigger className="group flex min-h-10 w-full items-center justify-between gap-3 rounded-md text-left hover:text-brand-line focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              {title}
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full border bg-block text-brand-line">
                <ChevronDown className="size-4 transition-transform group-data-[panel-open]:rotate-180 motion-reduce:transition-none" />
              </span>
            </CollapsibleTrigger>
          </h2>
          <CollapsibleContent className="pt-4 md:pt-5">{children}</CollapsibleContent>
        </Collapsible>
      ) : (
        <>
          <h2 id={headingId} className={headingClass}>{title}</h2>
          {children}
        </>
      )}
    </section>
  );
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
    <PageFrame spacing="space-y-6 md:space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Executive view</h1>
      <ExecutiveSection id="executive-metrics" title="Executive Metrics">
        <HeadlineTiles data={data} />
        <section id="degrading" aria-labelledby="domains-heading" className="scroll-mt-6 space-y-3 border-t pt-4">
          <h3 id="domains-heading" className="text-base font-semibold tracking-tight md:text-lg">Domains</h3>
          {missing("scorecard") ? <PartMissing part="scorecard" /> : <DomainScores domains={data.domains} />}
        </section>
      </ExecutiveSection>
      <ExecutiveSection id="leading-indicators" title="Leading Indicators">
        {missing("indicators") ? <PartMissing part="indicators" /> : <IndicatorCards indicators={data.indicators} />}
      </ExecutiveSection>
      <ExecutiveSection id="office-kpis" title="KPIs by Office">
        {missing("kpis") ? <PartMissing part="kpis" /> : <KpiTable kpis={data.kpis} />}
      </ExecutiveSection>
      <ExecutiveSection id="worst-accounts" title="Worst Accounts">
        <div data-testid="worst-accounts">
          {missing("accounts") ? <PartMissing part="accounts" /> : <WorstAccounts worst={data.worst} />}
        </div>
      </ExecutiveSection>
      <ExecutiveSection id="fix-first" title="Platform Repair Triage">
        <FixFirst
          rules={data.rules} scenarios={data.scenarios} by={by} domain={domain}
          impactMissing={missing("impact")} scorecardMissing={missing("scorecard")}
        />
      </ExecutiveSection>
      <ExecutiveSection id="trust" title="Data Integrity Status" collapsible>
        <TrustSection
          stress={data.stress} sensitivity={data.sensitivity} platformScore={data.platform?.score ?? null}
          missing={data.missing}
        />
      </ExecutiveSection>
    </PageFrame>
  );
}
