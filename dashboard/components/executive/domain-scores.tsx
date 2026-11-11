import Link from "next/link";
import { Pill } from "@/components/common";
import { domainTargetStatus, executiveHref, fmtScore } from "@/lib/executive";
import type { DomainScore } from "@/lib/executive-types";
import { toneColor } from "@/lib/status";
import { DetailDisclosure } from "./detail-disclosure";

const TOP = ["Accounts", "Securities", "Trades"];
const ORDER = [...TOP, "Corporate actions", "Positions", "Prices", "NAV"];
const LABELS = { ok: "Meets target", warn: "Within 1 point", bad: "Below target" };

function DomainCard({ domain }: { domain: DomainScore }) {
  const name = domain.domain === "Corporate actions" ? "Corporate Actions" : domain.domain;
  const { tone, target } = domainTargetStatus(domain.score, domain.target);
  return (
    <article data-testid="domain-card" className="flex w-full flex-col gap-2 rounded-xl border bg-block p-3 @min-[22rem]:w-[calc((100%_-_0.75rem)/2)] @min-[44rem]:w-[calc((100%_-_2.25rem)/4)] @min-[44rem]:p-3.5">
      <Link href={executiveHref({ domain: domain.domain })} className="self-start text-sm font-semibold text-brand-line underline-offset-2 hover:underline">
        {name}
      </Link>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <span data-testid="score" className="text-3xl leading-none font-semibold tracking-tight tabular-nums">{fmtScore(domain.score)}</span>
        {tone ? <Pill tone={tone}>{LABELS[tone]}</Pill> : (
          <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {domain.score === null ? "No score" : "No target"}
          </span>
        )}
      </div>
      <div
        role="img"
        aria-label={`Score ${fmtScore(domain.score)} on a scale of 0 to 100${target === null ? "" : `, target ${fmtScore(target)}`}`}
        className="relative my-1 h-2 rounded-full bg-muted"
      >
        {domain.score !== null && (
          <div className="h-full rounded-full" style={{
            width: `${Math.min(Math.max(domain.score, 0), 100)}%`,
            background: tone ? toneColor(tone) : "var(--muted-foreground)",
          }} />
        )}
        {target !== null && <span className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${target}%` }} />}
      </div>
      <DetailDisclosure label="Score details" accessibleLabel={`Score details for ${name}`} className="mt-auto">
        <dl className="space-y-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Coverage</dt><dd className="font-mono tabular-nums">{fmtScore(domain.coverage)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Confirmed-only score</dt><dd className="font-mono tabular-nums">{fmtScore(domain.confirmedOnly)}</dd></div>
          {target !== null && <div><dt className="text-xs text-muted-foreground">Minimum target</dt><dd className="font-mono tabular-nums">{fmtScore(target)}</dd></div>}
          <div><dt className="text-xs text-muted-foreground">Owner</dt><dd>{domain.owner}</dd></div>
        </dl>
      </DetailDisclosure>
    </article>
  );
}

export function DomainScores({ domains }: { domains: DomainScore[] }) {
  const known = ORDER.flatMap((name) => domains.filter((domain) => domain.domain === name));
  const top = known.filter((domain) => TOP.includes(domain.domain));
  const bottom = [...known.filter((domain) => !TOP.includes(domain.domain)), ...domains.filter((domain) => !ORDER.includes(domain.domain))];
  return (
    <div className="@container space-y-3">
      <p className="text-xs text-muted-foreground">Score scale 0–100</p>
      {[top, bottom].map((group, index) => group.length > 0 && (
        <div key={index} data-testid={index === 0 ? "domain-top-row" : "domain-bottom-row"} className="flex flex-wrap justify-center gap-3">
          {group.map((domain) => <DomainCard key={domain.domain} domain={domain} />)}
        </div>
      ))}
    </div>
  );
}
