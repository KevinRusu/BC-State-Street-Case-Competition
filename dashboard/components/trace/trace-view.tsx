"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Loader2, Search, SearchX } from "lucide-react";
import { Dot, Pill, RegisterStatus } from "@/components/common";
import { Graph, type TraceHighlight } from "@/components/flow/graph";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HOP_STATUS, REGISTER_STATUS, fmt, worstHop } from "@/lib/status";
import type { DemoTrace, Hop, HopStatus, MapData, TraceResult } from "@/lib/types";
import { TimelineStep } from "./timeline-step";

type Props = { map: MapData; demos: DemoTrace[]; query: string; trace: TraceResult | null };

const STORY_PREVIEW = 8;

export function TraceView({ map, demos, query, trace }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [pending, startTransition] = useTransition();
  const [allStories, setAllStories] = useState(false);

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
    return { nodes: group((h) => h.table), edges: group((h) => h.edge) };
  }, [trace]);

  const go = (id: string) => startTransition(() => router.push(`/trace?id=${encodeURIComponent(id.trim())}`));
  const stories = allStories ? demos : demos.slice(0, STORY_PREVIEW);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Trace a record</h1>
            <p className="text-sm text-muted-foreground">
              Type any ID and follow it through every join, from capture to NAV. The trail lights up on the map.
            </p>
          </div>
          <form
            className="flex w-full max-w-md gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (value.trim()) go(value);
            }}
          >
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="TXN…, ACC…, SEC…, POS…, CA…, LDG…, FND… or ACC…/SEC…"
              className="font-mono"
              aria-label="Record ID"
            />
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Search />} Trace
            </Button>
          </form>
        </div>

        {demos.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Stories: the records our findings point to
            </div>
            <div className="flex flex-wrap gap-2">
              {stories.map((demo) => (
                <Link
                  key={demo.recordId}
                  href={`/trace?id=${encodeURIComponent(demo.recordId)}`}
                  title={demo.source}
                  className={`flex max-w-xs items-center gap-2 rounded-lg bg-block px-2.5 py-1.5 text-xs ring-1 transition-colors hover:bg-muted ${demo.recordId === query ? "ring-brand-line" : "ring-transparent"}`}
                >
                  <Dot tone={demo.status === "trace" ? "ok" : REGISTER_STATUS[demo.status] ?? "info"} />
                  <span className="truncate">{demo.label}</span>
                  <span className="shrink-0 font-mono text-muted-foreground">{demo.recordId}</span>
                </Link>
              ))}
              {demos.length > STORY_PREVIEW && (
                <Button variant="ghost" size="sm" onClick={() => setAllStories(!allStories)}>
                  {allStories ? "Show fewer" : `Show all ${demos.length}`}
                </Button>
              )}
            </div>
          </div>
        )}

        {trace && !trace.found && (
          <Card className="bg-block ring-0">
            <CardContent className="flex items-start gap-3 py-2 text-sm">
              <SearchX className="mt-0.5 size-5 text-status-warn" />
              <div>
                <p>
                  No record has the ID <span className="font-mono">{trace.query}</span> in any table.
                </p>
                <p className="text-muted-foreground">
                  IDs look like TXN…, ACC…, SEC…, POS…, CMP…, LDG…, FND…, CA…, or ACC…/SEC… for an account + security key.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {trace?.found && <TraceSummary trace={trace} />}

        {/* From xl up the map stays in view (sticky) beside the steps; below that they stack. */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-start">
          <Card className="overflow-hidden p-0 xl:sticky xl:top-0">
            <div className="h-[460px] xl:h-[600px]">
              <Graph
                data={map}
                showLookups={false}
                animate={false}
                trace={highlight}
                onSelect={(selection) => {
                  if (selection?.kind !== "node") return;
                  document.querySelector(`[data-hop-table="${selection.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            </div>
          </Card>

          {trace?.found ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">The steps</div>
              <ol>
                {trace.hops.map((hop, index) => (
                  <TimelineStep
                    key={hop.id}
                    hop={hop}
                    step={index + 1}
                    place={map.nodes.find((n) => n.id === hop.table)?.place ?? ""}
                    last={index === trace.hops.length - 1}
                  />
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick a story above or type an ID. Each step shows the raw rows (as text) the join found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TraceSummary({ trace }: { trace: Extract<TraceResult, { found: true }> }) {
  const broken = trace.hops.filter((h) => h.status === "missing");
  const extra = trace.hops.filter((h) => h.status === "fan_out");
  return (
    <Card className="bg-block ring-0">
      <CardContent className="space-y-3 py-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-base font-semibold">{trace.query}</span>
          <span className="text-sm text-muted-foreground">{trace.kind}</span>
          {trace.summary && <span className="text-sm text-muted-foreground">· {trace.summary}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {broken.length ? (
            <Pill tone="bad">Trail breaks at: {broken.map((h) => h.title).join(", ")}</Pill>
          ) : (
            <Pill tone="ok">Every expected step found a match</Pill>
          )}
          {extra.length > 0 && <Pill tone="warn">More rows than expected at: {extra.map((h) => h.title).join(", ")}</Pill>}
          <span className="text-xs text-muted-foreground">
            {trace.hops.length} steps · {fmt(trace.hops.reduce((n, h) => n + h.total, 0))} rows touched
          </span>
        </div>
        {trace.marks.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Named as an example in notebook 02&apos;s register:</div>
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
          Legend:{" "}
          {(["ok", "fan_out", "missing", "info"] as HopStatus[]).map((s) => (
            <span key={s} className="mr-3 inline-flex items-center gap-1.5">
              <Dot tone={HOP_STATUS[s].tone} /> {HOP_STATUS[s].label}
            </span>
          ))}
        </p>
      </CardContent>
    </Card>
  );
}
