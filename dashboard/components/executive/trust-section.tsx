import { ChevronDown } from "lucide-react";
import { Pill } from "@/components/common";
import { PartMissing } from "@/components/executive/part-missing";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RUN_FACTS, fmtCount, fmtNumber, fmtScore, fmtShare, fmtUsd, stressState } from "@/lib/executive";
import type { Part, Sensitivity, Stress, StressMeasure } from "@/lib/executive-types";

type Num = number | null;

const ROLES: { role: string; title: string }[] = [
  { role: "defect", title: "Planted defects" },
  { role: "lookalike", title: "Valid look-alikes" },
  { role: "flip", title: "Priority flips" },
];

const VARIANTS: { variant: string; title: string }[] = [
  { variant: "nav_proximity", title: "NAV-weighted" },
  { variant: "weakest_link", title: "Weakest link" },
  { variant: "confirmed_only", title: "Confirmed only" },
];

const subhead = "text-xs font-semibold tracking-wide text-muted-foreground uppercase";

/** A score change with its sign: fmtScore already prints a real minus; a positive gets a "+", zero none. */
function signedScore(v: Num): string {
  const text = fmtScore(v);
  return v !== null && v > 0 && text !== fmtScore(0) ? `+${text}` : text;
}

/** A before / after value: dollars for a usd measure, a score for a score or value measure, else a count. */
function measureText(m: StressMeasure, v: Num): string {
  if (v === null) return "none valued";
  const name = m.measure.toLowerCase();
  if (name.includes("usd")) return fmtUsd(v);
  if (name.includes("score") || name.includes("value")) return fmtScore(v);
  return fmtCount(v);
}

function RatesTable({ title, rates }: { title: string; rates: Stress["rates"] }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Level</TableHead>
            <TableHead>Cases</TableHead>
            <TableHead>Share</TableHead>
            <TableHead>Drawn</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rates.map((r) => (
            <TableRow key={r.level}>
              <TableCell>{r.level.replaceAll("_", " ")}</TableCell>
              <TableCell className="font-mono tabular-nums">{fmtCount(r.cases)}</TableCell>
              <TableCell className="font-mono tabular-nums">{fmtShare(r.share)}</TableCell>
              <TableCell className="text-muted-foreground">drawn {fmtCount(r.drawn)} of {fmtCount(r.wanted)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StressBlock({ stress, state }: { stress: Stress; state: "older run" | "current" }) {
  const untouched = stress.rates.filter((r) => r.role === "untouched");
  const falsePositive = untouched.find((r) => r.level.replaceAll("_", " ") === "false positive");
  const unattributable = untouched.find((r) => r.level.replaceAll("_", " ") === "unattributable");
  const facts = RUN_FACTS.filter((k) => k in stress.run).map((k) => `${k}: ${stress.run[k]}`);
  return (
    <div className="space-y-4">
      {state === "older run" && (
        <div role="note" className="flex items-start gap-2 text-sm">
          <Pill tone="warn">older run</Pill>
          <span>These stress results come from an older run: its platform score before injection differs from the scorecard&apos;s.</span>
        </div>
      )}
      {ROLES.map(({ role, title }) => (
        <RatesTable key={role} title={title} rates={stress.rates.filter((r) => r.role === role)} />
      ))}
      <ul className="space-y-1 text-sm">
        {falsePositive && (
          <li>
            Changes on untouched securities (false positives): <span className="font-mono tabular-nums">{fmtCount(falsePositive.cases)}</span>
          </li>
        )}
        {unattributable && (
          <li>
            Changes no case explains: <span className="font-mono tabular-nums">{fmtCount(unattributable.cases)}</span>
          </li>
        )}
      </ul>
      {stress.measures.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Before and after injection</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Measure</TableHead>
                <TableHead>Before</TableHead>
                <TableHead>After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stress.measures.map((m) => (
                <TableRow key={m.measure}>
                  <TableCell className="whitespace-normal">{m.measure}</TableCell>
                  <TableCell className="font-mono tabular-nums">{measureText(m, m.before)}</TableCell>
                  <TableCell className="font-mono tabular-nums">{measureText(m, m.after)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {facts.length > 0 && <p className="text-xs break-words text-muted-foreground">{facts.join(" · ")}</p>}
      <p className="text-xs text-muted-foreground">
        The rates hold for the sample drawn (held equities whose vendor check passes on the snapshot); they are not a
        general detection rate.
      </p>
      <p className="text-xs text-muted-foreground">The severity scale row values look-alikes too, so it is an upper bound.</p>
    </div>
  );
}

function SensitivityBlock({ rows }: { rows: Sensitivity[] }) {
  const of = (variant: string, level: string) => rows.find((r) => r.variant === variant && r.level === level);
  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Variant</TableHead>
            <TableHead>Platform score</TableHead>
            <TableHead>Change vs main</TableHead>
            <TableHead>Worst accounts kept</TableHead>
            <TableHead>Ties at the cut</TableHead>
            <TableHead>Rank correlation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {VARIANTS.map(({ variant, title }) => {
            const platform = of(variant, "platform");
            const accounts = of(variant, "accounts");
            if (!platform && !accounts) return null;
            return (
              <TableRow key={variant}>
                <TableCell className="font-medium whitespace-normal">{title}</TableCell>
                <TableCell className="font-mono tabular-nums">{fmtScore(platform?.score ?? null)}</TableCell>
                <TableCell className="font-mono tabular-nums">{signedScore(platform?.change ?? null)}</TableCell>
                <TableCell className="whitespace-normal">
                  worst {fmtCount(accounts?.worstN ?? null)} accounts kept:{" "}
                  <span className="font-mono tabular-nums">{fmtCount(accounts?.worstNKept ?? null)}</span>
                </TableCell>
                <TableCell className="font-mono tabular-nums">{fmtCount(accounts?.tiesAtCutoff ?? null)}</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {fmtNumber(accounts?.rankCorrelation ?? null)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Collapsible>
        <CollapsibleTrigger className="group flex items-center gap-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground">
          By domain
          <ChevronDown className="size-3.5 shrink-0 transition-transform group-data-[panel-open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variant</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Main score</TableHead>
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {VARIANTS.flatMap(({ variant, title }) =>
                rows.filter((r) => r.variant === variant && r.level === "domain").map((r) => (
                  <TableRow key={`${variant}-${r.name}`}>
                    <TableCell>{title}</TableCell>
                    <TableCell className="whitespace-normal">{r.name}</TableCell>
                    <TableCell className="font-mono tabular-nums">{fmtScore(r.score)}</TableCell>
                    <TableCell className="font-mono tabular-nums">{fmtScore(r.mainScore)}</TableCell>
                    <TableCell className="font-mono tabular-nums">{signedScore(r.change)}</TableCell>
                  </TableRow>
                )),
              )}
            </TableBody>
          </Table>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

type Props = { stress: Stress | null; sensitivity: Sensitivity[]; platformScore: Num; missing: Part[] };

/** "Can we trust these numbers?": what the stress test caught, and how much the score moves under other weightings. */
export function TrustSection({ stress, sensitivity, platformScore, missing }: Props) {
  const state = missing.includes("stress") ? "not run" : stressState(stress, platformScore);
  return (
    <>
      <div className="space-y-3" data-testid="stress">
        <h3 className={subhead}>Stress test</h3>
        {state === "not run" || stress === null ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            The stress test has not been run on these outputs. Run tests/stress_test.sh, then rebuild the store.
          </p>
        ) : (
          <StressBlock stress={stress} state={state} />
        )}
      </div>
      <div className="space-y-3" data-testid="sensitivity">
        <h3 className={subhead}>Sensitivity of the score</h3>
        {missing.includes("sensitivity") ? <PartMissing part="sensitivity" /> : <SensitivityBlock rows={sensitivity} />}
      </div>
    </>
  );
}
