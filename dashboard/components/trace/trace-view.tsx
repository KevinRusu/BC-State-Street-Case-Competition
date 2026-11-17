"use client";

import { useRouter } from "next/navigation";
import { useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { ChevronDown, Loader2, Search, SearchX } from "lucide-react";
import { Dot, Pill, RegisterStatus } from "@/components/common";
import { Graph, type TraceHighlight, type TraceStepControl } from "@/components/flow/graph";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { EXAMPLES_ONLY, examplesOnlyNote, storyGroups, traceHeadline } from "@/lib/plain";
import { HOP_STATUS, REGISTER_STATUS, fmt, toneColor, toneText, worstHop } from "@/lib/status";
import { locateFindings, markCounts } from "@/lib/trace-findings";
import type { DemoTrace, Hop, HopStatus, MapData, PlainText, TraceResult } from "@/lib/types";
import { TimelineStep } from "./timeline-step";

type Props = { map: MapData; demos: DemoTrace[]; query: string; trace: TraceResult | null };
type FoundTrace = Extract<TraceResult, { found: true }>;

const go = (router: ReturnType<typeof useRouter>, id: string) =>
  router.push(`/trace?id=${encodeURIComponent(id.trim())}`, { scroll: false });

/** The search box. Keyed by the record, so a draft typed but not submitted is gone after the next record opens. */
function TraceSearch({ query }: { query: string }) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex w-full gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) startTransition(() => go(router, value));
      }}
    >
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="TXN…, ACC…, SEC…, POS…, CMP…, CA…, LDG…, FND… or ACC…/SEC…"
        className="font-mono"
        aria-label="Record ID"
      />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Search />} Trace
      </Button>
    </form>
  );
}

/** One "Pick an example" menu, the stories grouped by register stage. It rests on its placeholder whenever the
 * record on screen is not a story. Keep the control mounted across selections so keyboard focus stays on it. */
function StoryPicker({ demos, query, plain }: { demos: DemoTrace[]; query: string; plain: PlainText }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const groups = useMemo(() => storyGroups(demos, plain), [demos, plain]);
  const current = demos.some((d) => d.recordId === query) ? query : "";
  const [selected, choose] = useOptimistic(current);
  return (
    <div className="relative min-w-0 flex-1">
      <select
        aria-label="Pick an example"
        aria-busy={pending}
        value={selected}
        onChange={(event) => {
          const id = event.target.value;
          if (id) startTransition(() => {
            choose(id);
            go(router, id);
          });
        }}
        className="trace-story-picker h-8 w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg border border-input bg-background py-1 pr-8 pl-2.5 text-sm text-foreground transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        <option value="" disabled>
          Pick an example
        </option>
        {groups.map((group) => (
          <optgroup key={group.stage} label={group.label || "Other examples"}>
            {group.stories.map((story) => (
              <option key={story.recordId} value={story.recordId}>
                {story.label} · {story.recordId}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {pending ? (
        <Loader2 aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
    </div>
  );
}

export function TraceView({ map, demos, query, trace }: Props) {
  const steps = useRef<HTMLDivElement>(null);
  const [stepState, setStepState] = useState<{ query: string; open: Record<string, boolean> }>({ query, open: {} });
  // Reset overrides before rendering another record, while leaving the picker and ID lookup mounted.
  if (stepState.query !== query) setStepState({ query, open: {} });
  const highlight = useMemo<TraceHighlight | undefined>(() => {
    if (!trace?.found) return undefined;
    const group = (key: (h: Hop) => string | null) => {
      const out: Record<string, HopStatus[]> = {};
      for (const hop of trace.hops) {
        const k = key(hop);
        if (k) (out[k] ??= []).push(hop.status);
      }
      return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, worstHop(v)]));
    };
    return {
      nodes: group((h) => h.table), edges: group((h) => h.edge),
      findings: locateFindings(trace.hops, trace.marks),
    };
  }, [trace]);
  const isStepOpen = (hop: Hop) => stepState.open[hop.id] ?? Boolean(highlight?.findings.hops[hop.id]?.length);
  const traceSteps: Record<string, TraceStepControl> = {};
  if (trace?.found) {
    for (const hop of trace.hops) {
      const control = traceSteps[hop.table] ??= { expanded: false, controls: "" };
      control.expanded ||= isStepOpen(hop);
      control.controls += `${control.controls ? " " : ""}trace-step-${hop.id}-details`;
    }
  }

  return (
    <div data-trace-layout className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(15.5rem,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden">
      <section className="flex min-w-0 shrink-0 flex-col gap-2 lg:col-start-1 lg:row-start-1 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3" aria-label="Record picker">
        <div>
          <h1 className="text-lg font-semibold">Trace a record</h1>
          <p className="text-sm text-muted-foreground">
            Select a record, then pick a map box to open its steps.
          </p>
        </div>
        <Collapsible className="min-w-0 lg:w-full lg:max-w-lg lg:justify-self-end">
          <div className="flex min-w-0 items-center gap-2">
            {/* Use the resolved ID so a padded URL still selects its story. */}
            {demos.length > 0 && <StoryPicker demos={demos} query={trace?.query ?? query} plain={map.plain} />}
            <CollapsibleTrigger render={<Button variant="ghost" size="sm" className="shrink-0" />}>
              <Search className="size-3.5" /> Find an ID
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="pt-2">
            <TraceSearch key={query} query={query} />
          </CollapsibleContent>
        </Collapsible>
      </section>

      <Card data-trace-map className="h-[clamp(17rem,65vw,26rem)] min-w-0 shrink-0 overflow-hidden p-0 lg:col-start-1 lg:row-start-2 lg:h-auto lg:min-h-0">
        <Graph
          data={map}
          showLookups={false}
          animate={false}
          trace={highlight}
          traceSteps={traceSteps}
          onSelect={(selection) => {
            if (!selection) return;
            const candidates = trace?.found ? trace.hops.filter((h) => selection.kind === "node"
              ? h.table === selection.id : h.edge === selection.id) : [];
            const hop = candidates.find((h) => highlight?.findings.hops[h.id]?.length) ?? candidates[0];
            if (selection.kind === "node" && candidates.length) {
              const open = !candidates.some(isStepOpen);
              setStepState((previous) => ({ query, open: {
                ...previous.open, ...Object.fromEntries(candidates.map((h) => [h.id, open])),
              } }));
            }
            // Wait for expanded/collapsed content to lay out before scrolling the evidence pane.
            requestAnimationFrame(() => {
              const target = hop && document.getElementById(`trace-step-${hop.id}`);
              if (!target || !steps.current) return;
              if (window.matchMedia("(min-width: 1024px)").matches) {
                steps.current.scrollTo({
                  top: target.getBoundingClientRect().top - steps.current.getBoundingClientRect().top + steps.current.scrollTop,
                  behavior: "smooth",
                });
              } else target.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }}
        />
      </Card>

      <aside
        data-trace-details
        aria-label="Record summary and steps"
        className="flex min-w-0 shrink-0 flex-col gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-0"
      >
        <div
          key={query}
          role="region"
          aria-label="Selected record"
          tabIndex={trace ? 0 : undefined}
          className="min-w-0 shrink-0 empty:hidden lg:max-h-[43%] lg:overflow-y-auto lg:overscroll-contain"
        >
          {trace?.found && <TraceSummary trace={trace} plain={map.plain} allMembers={map.info.memberSource === "members"} />}
          {trace && !trace.found && (
            <Card className="bg-block ring-0">
              <CardContent className="flex items-start gap-3 py-1 text-sm">
                <SearchX className="mt-0.5 size-5 shrink-0 text-status-warn" />
                <div className="min-w-0 space-y-1">
                  <p>No record has the ID <span className="font-mono break-all">{trace.query}</span> in any table.</p>
                  <p className="text-muted-foreground">Try another example or use Find an ID to look up a transaction, account, security or holding key.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card lg:min-h-0 lg:flex-1">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-block px-3 py-2.5">
            <h2 id="trace-steps-heading" className="text-sm font-semibold">The steps</h2>
            {trace?.found && <span className="rounded-full border bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{trace.hops.length} steps</span>}
          </div>
          {trace?.found ? (
            <div ref={steps} key={query} data-trace-steps role="region" tabIndex={0} aria-labelledby="trace-steps-heading" className="px-2.5 pt-2.5 pb-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-gutter:stable]">
              <ol>
                {trace.hops.map((hop, index) => (
                  <TimelineStep
                    key={`${query}-${hop.id}`}
                    hop={hop}
                    findings={highlight?.findings.hops[hop.id] ?? []}
                    step={index + 1}
                    place={map.nodes.find((n) => n.id === hop.table)?.place ?? ""}
                    last={index === trace.hops.length - 1}
                    query={trace.query}
                    plain={map.plain}
                    open={isStepOpen(hop)}
                    onOpenChange={(open) => setStepState((previous) => ({ query, open: { ...previous.open, [hop.id]: open } }))}
                  />
                ))}
              </ol>
            </div>
          ) : (
            <p className="p-3 text-sm text-muted-foreground">
              Pick an example or use Find an ID to see the steps.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}

const OLD_STORE = "This store was built before the plain wording. Rebuild it: ";

/** The record in plain words first (what is wrong and how sure we are); rule IDs, register lines, the legend and the
 * caveats sit one click deeper under "Technical details". */
function TraceSummary({ trace, plain, allMembers }: { trace: FoundTrace; plain: PlainText; allMembers: boolean }) {
  const broken = trace.hops.filter((h) => h.status === "missing");
  const headline = traceHeadline(trace.query, trace.marks, plain);
  const note = examplesOnlyNote(trace.marks, allMembers);
  const tone = REGISTER_STATUS[headline.status] ?? "info";
  return (
    <Card data-trace-summary size="sm" className="min-w-0 bg-block ring-0">
      <CardContent className="space-y-2 py-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="min-w-0 font-mono text-sm font-semibold break-all">{trace.query}</span>
          <span className="text-sm text-muted-foreground">{trace.kind}</span>
        </div>
        <div className="space-y-1 border-l-[3px] pl-3" style={{ borderColor: toneColor(tone) }} data-headline-tone={tone}>
          {headline.text ? (
            <p className="text-sm leading-snug break-words">{headline.text}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {OLD_STORE}
              <code className="font-mono">uv run python scripts/build_store.py</code>
            </p>
          )}
          {(headline.phrase || headline.more > 0) && (
            <p className="text-sm">
              {headline.phrase && (
                <span className="font-medium" style={{ color: toneText(tone) }}>
                  {headline.phrase}
                </span>
              )}
              {headline.more > 0 && (
                <span className="text-muted-foreground">
                  {headline.phrase && " ·"} and {headline.more} more finding{headline.more === 1 ? "" : "s"}
                </span>
              )}
            </p>
          )}
          {note && <p className="text-sm text-muted-foreground" data-examples-only>{note}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {broken.length ? (
            <Pill tone="bad" className="whitespace-normal">Trail breaks at: {broken.map((h) => h.title).join(", ")}</Pill>
          ) : (
            <Pill tone="ok">Required record links found</Pill>
          )}
        </div>
        <TechnicalDetails trace={trace} allMembers={allMembers} />
      </CardContent>
    </Card>
  );
}

/** Everything the summary card showed before the plain headline, unchanged, behind one link. */
function TechnicalDetails({ trace, allMembers }: { trace: FoundTrace; allMembers: boolean }) {
  const extra = trace.hops.filter((h) => h.status === "fan_out");
  const findings = markCounts(trace.marks);
  return (
    <Collapsible>
      <CollapsibleTrigger className="group inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Technical details
        <ChevronDown className="size-3.5 transition-transform group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        {trace.summary && <p className="text-sm text-muted-foreground">{trace.summary}</p>}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {extra.length > 0 && <Pill tone="warn" className="whitespace-normal">More rows than expected at: {extra.map((h) => h.title).join(", ")}</Pill>}
          {(["confirmed", "unresolved", "cleared"] as const).filter((s) => findings[s] > 0).map((status) => (
            <Pill key={status} tone={REGISTER_STATUS[status]}>
              {findings[status]} {status} finding{findings[status] === 1 ? "" : "s"}
            </Pill>
          ))}
          {trace.marks.length === 0 && <Pill tone="info">No register finding counts this record</Pill>}
          <span className="text-xs text-muted-foreground">
            {trace.hops.length} steps · {fmt(trace.hops.reduce((n, h) => n + h.total, 0))} rows touched
          </span>
        </div>
        {trace.marks.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">The deliverable notebook&apos;s register lines that count this record, its account, security or key:</div>
            <ul className="space-y-1">
              {trace.marks.map((mark) => (
                <li key={`${mark.line}-${mark.recordId}`} className="flex flex-wrap items-center gap-2 text-sm">
                  <RegisterStatus status={mark.status} />
                  {mark.finding}
                  <span className="font-mono text-xs text-muted-foreground">
                    {mark.ruleId} · line {mark.line}
                    {mark.recordId !== trace.query && ` · via ${mark.recordId}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Record links:{" "}
          {(["ok", "fan_out", "missing", "info", "not_reached"] as HopStatus[]).map((s) => (
            <span key={s} className="mr-3 inline-flex items-center gap-1.5">
              <Dot tone={HOP_STATUS[s].tone} /> {HOP_STATUS[s].label}
            </span>
          ))}
        </p>
        <p className="text-xs text-muted-foreground">
          A green link means matching records were found; it does not mean their values passed every control.
          {allMembers
            ? " Finding badges show every register line that counts this record."
            : ` ${EXAMPLES_ONLY}`}
          {" "}It is still not a complete assessment of every record: rules not yet coded find nothing, so no badge is
          not proof that the record is valid.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
