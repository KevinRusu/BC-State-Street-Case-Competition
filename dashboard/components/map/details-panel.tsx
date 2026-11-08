"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, ChevronDown, Info } from "lucide-react";
import { CheckBadge, Dot, FindingDots, Metric, Pill, RegisterStatus, Section, SourceChip } from "@/components/common";
import { RulesList } from "@/components/rules-list";
import { edgeIssue, type Selection } from "@/components/flow/graph";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { countsFor, type Counts } from "@/lib/findings";
import { countsTone, stageLines, type StageLine } from "@/lib/plain";
import { JOIN_STATUS, REGISTER_STATUS, fmt, toneText } from "@/lib/status";
import type { JoinSide, MapData, MapEdge, MapNode, RegisterLine, Status } from "@/lib/types";

type Props = { data: MapData; selection: Selection; onSelect: (selection: Selection) => void };

/** The map's side panel: plain words first, technical detail one click deeper (folded). */
export function DetailsPanel({ data, selection, onSelect }: Props) {
  // A new selection starts at its heading, even when it was picked from far down the panel ("Show on map").
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.parentElement?.scrollTo({ top: 0 });
  }, [selection?.kind, selection?.id]);
  return (
    <div ref={root} data-map-panel>
      {/* Keyed by id: each place opens with its folds as the brief sets them, not as the last place left them. */}
      {selection?.kind === "node" ? (
        <NodeDetails key={selection.id} data={data} id={selection.id} onSelect={onSelect} />
      ) : selection?.kind === "edge" ? (
        <EdgeDetails key={selection.id} data={data} id={selection.id} onSelect={onSelect} />
      ) : (
        <Overview data={data} onSelect={onSelect} />
      )}
    </div>
  );
}

/** A folded section: the uppercase section title as its trigger, with a chevron that turns when open. */
function Fold({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="py-3">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground">
        {title}
        <ChevronDown className="size-3.5 shrink-0 transition-transform group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2.5 pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** "6 confirmed · 2 unresolved · 1 cleared", leaving out the zero parts ("" when all are zero). */
const countsText = (counts: Counts) =>
  (["confirmed", "unresolved", "cleared"] as const).filter((s) => counts[s] > 0).map((s) => `${counts[s]} ${s}`).join(" · ");

/** The findings counted on one place, in one line, with a dot in the worst status's colour. */
function CountsLine({ counts, empty }: { counts: Counts; empty: string }) {
  const tone = countsTone(counts);
  return (
    <p className="flex items-center gap-2 text-sm">
      {tone && <Dot tone={tone} />}
      {countsText(counts) || <span className="text-muted-foreground">{empty}</span>}
    </p>
  );
}

const linkStyle = "font-medium text-brand-line underline-offset-4 hover:underline";

/** One register line in plain words, its status, and where to see it: on the map, and traced through one example. */
function FindingRow({ line, onSelect, here }: { line: RegisterLine; onSelect: Props["onSelect"]; here?: Props["selection"] }) {
  const kind = line.mapKind, id = line.mapId;
  const example = line.traceExample;   // only an ID the trace can open (build_store.py decides)
  const showOnMap = kind !== "" && !(here?.kind === kind && here.id === id);
  return (
    <li className="space-y-1.5 py-2">
      <div className="flex items-start gap-2 text-sm leading-snug">
        <RegisterStatus status={line.status} />
        <span className="min-w-0">{line.plain || line.finding}</span>
      </div>
      {(showOnMap || example) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {showOnMap && (
            <button type="button" className={linkStyle} onClick={() => kind && onSelect({ kind, id })}>
              Show on map
            </button>
          )}
          {example && (
            <Link href={`/trace?id=${encodeURIComponent(example)}`} prefetch={false} className={linkStyle}>
              Trace an example
            </Link>
          )}
        </div>
      )}
    </li>
  );
}

/** A register stage: its dot, label and counts; clicking it lists its lines in place. */
function StageRow({ stage, onSelect }: { stage: StageLine; onSelect: Props["onSelect"] }) {
  const tone = countsTone(stage.counts);
  return (
    <li>
      <Collapsible>
        <CollapsibleTrigger
          data-stage={stage.stage}
          className="group flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-block"
        >
          {tone ? <Dot tone={tone} className="mt-1.5" /> : <span className="size-2 shrink-0" />}
          <span className="min-w-0 flex-1">{stage.label || stage.stage}</span>
          <span className="mt-0.5 shrink-0 text-xs text-muted-foreground tabular-nums">{countsText(stage.counts)}</span>
          <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mx-2 mb-2 divide-y border-l pl-3">
            {stage.lines.map((line) => (
              <FindingRow key={line.line} line={line} onSelect={onSelect} />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

const label = (data: MapData, id: string) => data.nodes.find((n) => n.id === id)?.label ?? id;

/** One join in a list: its check number (or health dot), name, a second line, and what counts on it. */
function JoinRow({ data, edge, onSelect, detail }: { data: MapData; edge: MapEdge; onSelect: Props["onSelect"]; detail: React.ReactNode }) {
  const issue = edgeIssue(edge.id, data.health);
  return (
    <button
      type="button"
      onClick={() => onSelect({ kind: "edge", id: edge.id })}
      className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-block"
    >
      {edge.handoff !== null ? <CheckBadge n={edge.handoff} /> : <Dot tone={JOIN_STATUS[edge.status].tone} className="mt-1.5" />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline justify-between gap-2">
          <span className={edge.handoff !== null ? "font-medium" : undefined}>{edge.label}</span>
          <span className="flex shrink-0 items-center gap-2 text-xs">
            <FindingDots counts={countsFor(data.register, "edge", edge.id)} />
            {issue && (
              <span className="tabular-nums" style={{ color: toneText(JOIN_STATUS[edge.status].tone) }}>
                {issue}
              </span>
            )}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}

const route = (data: MapData, edge: MapEdge) => (
  <>
    {label(data, edge.source)} <ArrowRight className="inline size-3" /> {label(data, edge.target)}
  </>
);

function Overview({ data, onSelect }: { data: MapData; onSelect: Props["onSelect"] }) {
  const checks = data.edges.filter((e) => e.handoff !== null).sort((a, b) => a.handoff! - b.handoff!);
  const others = data.edges.filter((e) => e.handoff === null);
  const placed = new Set([...data.nodes.flatMap((n) => n.rules), ...data.edges.flatMap((e) => e.rules)]);
  const unplaced = [...new Set(data.register.map((r) => r.ruleId))].filter((r) => r && !placed.has(r));
  return (
    <div className="space-y-5 p-5">
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">How data moves, and where it breaks</h2>
        <p className="text-sm text-muted-foreground">Follow left to right. Blue numbers are our checks. Click anything for details.</p>
      </div>
      <ul className="-mx-2 space-y-0.5" aria-label="Findings by stage">
        {stageLines(data.register, data.plain).map((stage) => (
          <StageRow key={stage.stage} stage={stage} onSelect={onSelect} />
        ))}
      </ul>
      <div className="divide-y border-y">
        <Fold title="All checks">
          <div className="-mx-2">
            {checks.map((edge) => (
              <JoinRow key={edge.id} data={data} edge={edge} onSelect={onSelect} detail={`${edge.owner} · ${edge.checkOffice}`} />
            ))}
          </div>
        </Fold>
        <Fold title="Other joins">
          <div className="-mx-2">
            {others.map((edge) => (
              <JoinRow key={edge.id} data={data} edge={edge} onSelect={onSelect} detail={route(data, edge)} />
            ))}
          </div>
        </Fold>
        {unplaced.length > 0 && (
          <Fold title="Register rules not on the map">
            <p className="font-mono text-xs">{unplaced.join(", ")}</p>
          </Fold>
        )}
        <Fold title="What the colours mean">
          <Legend />
        </Fold>
      </div>
      <Note />
    </div>
  );
}

/** The map's colours: an arrow's colour is the health of its keys; a dot by a count is a finding's status. */
function Legend() {
  return (
    <div className="space-y-3 text-xs text-muted-foreground">
      <p className="text-sm">
        A <b className="text-foreground">row</b> is the office that handles a table; the <b className="text-foreground">columns</b>{" "}
        follow the data. <b className="text-brand-line">Blue numbers</b> are our checks. An arrow&apos;s colour is the health
        of its keys; dashed means the data can&apos;t prove the link.
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {(["ok", "fan_out", "blank_keys", "orphans", "info"] as Status[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5" title={JOIN_STATUS[s].meaning}>
            <Dot tone={JOIN_STATUS[s].tone} /> {JOIN_STATUS[s].label}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>Findings:</span>
        {(["confirmed", "unresolved", "cleared"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <Dot tone={REGISTER_STATUS[s]} /> {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/** "What we found" on one place of the map: its register lines in plain words (nothing when there are none). */
function FoundHere({ data, kind, id, onSelect }: { data: MapData; kind: "node" | "edge"; id: string; onSelect: Props["onSelect"] }) {
  const lines = data.register.filter((l) => l.mapKind === kind && l.mapId === id);
  if (!lines.length) return null;
  return (
    <Fold title="What we found" defaultOpen>
      <ul className="divide-y">
        {lines.map((line) => (
          <FindingRow key={line.line} line={line} onSelect={onSelect} here={{ kind, id }} />
        ))}
      </ul>
    </Fold>
  );
}

/** Who handles a table (or checks an independent source), and where its data comes from. */
function Ownership({ node }: { node: MapNode }) {
  return (
    <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-3 rounded-xl bg-block p-3.5 text-sm">
      <dt className="text-muted-foreground">{node.office === "independent" ? "Checked by" : "Handled by"}</dt>
      <dd>
        <span className="font-medium">
          {node.checkOffice} · {node.owner}
        </span>
        {node.note && <p className="mt-0.5 text-xs text-muted-foreground">{node.note}</p>}
      </dd>
      {node.sources.length > 0 && (
        <>
          <dt className="text-muted-foreground">Comes from</dt>
          <dd className="space-y-2">
            {node.sources.map((source) => (
              <div key={source.label} className="space-y-1">
                <SourceChip source={source} className="text-xs" />
                {source.evidence === "data" ? (
                  <p className="text-xs text-muted-foreground">
                    Seen in the data: <span className="font-mono">{source.column}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {source.values.map((v) => (
                        <span key={v} className="rounded bg-[var(--chip-data)] px-1.5 py-px font-mono text-[11px] text-foreground">
                          {v}
                        </span>
                      ))}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{source.reason}</p>
                )}
              </div>
            ))}
          </dd>
        </>
      )}
    </dl>
  );
}

function NodeDetails({ data, id, onSelect }: { data: MapData; id: string; onSelect: Props["onSelect"] }) {
  const node = data.nodes.find((n) => n.id === id);
  if (!node) return null;
  const joins = data.edges.filter((e) => e.source === id || e.target === id);
  const columns = data.columns.filter((c) => c.table === id);
  return (
    <div className="space-y-4 p-5">
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">{node.place}</div>
        <h2 className="text-lg font-semibold">{node.label}</h2>
        <p className="font-mono text-xs text-muted-foreground">{node.id}</p>
        {node.plain && <p className="pt-1.5 text-sm leading-relaxed">{node.plain}</p>}
      </div>
      <CountsLine counts={countsFor(data.register, "node", id)} empty="No finding counts on this table." />
      <div className="divide-y border-y">
        <FoundHere data={data} kind="node" id={id} onSelect={onSelect} />
        <Fold title="Who owns this">
          <Ownership node={node} />
        </Fold>
        <Fold title="Raw key counts (technical)">
          <p className="text-sm italic">{node.grain}</p>
          <Metric label="Loaded (as text)" value={fmt(node.rows)} />
          <Metric
            label="Manifest says"
            value={fmt(node.manifestRows)}
            tone={node.rows === node.manifestRows ? "ok" : "bad"}
          />
          <Metric label="Columns" value={node.columns} />
          {node.unreadableDates && <Metric label="Unreadable dates" value={node.unreadableDates} tone="warn" />}
          <div className="pt-2 text-xs text-muted-foreground">Joins</div>
          <div className="-mx-2">
            {joins.map((edge) => (
              <JoinRow key={edge.id} data={data} edge={edge} onSelect={onSelect} detail={route(data, edge)} />
            ))}
          </div>
        </Fold>
        <Fold title="Rules (technical)">
          <RulesList ruleIds={node.rules} catalog={data.catalog} register={data.register} />
        </Fold>
        <Fold title={`Columns (${columns.length})`}>
          <dl className="space-y-2">
            {columns.map((c) => (
              <div key={c.column} className="text-xs">
                <dt className="font-mono font-medium">
                  {c.column} <span className="font-sans text-muted-foreground">· {c.intendedType}</span>
                </dt>
                <dd className="text-muted-foreground">{c.description}</dd>
              </div>
            ))}
          </dl>
        </Fold>
      </div>
    </div>
  );
}

function sideFacts(side: JoinSide, otherTable: string) {
  const facts: { tone: "ok" | "warn" | "bad" | "info"; text: string }[] = [];
  if (side.blankKeyRows)
    facts.push({ tone: side.required ? "warn" : "info", text: `${fmt(side.blankKeyRows)} rows have a blank key and cannot join` });
  if (side.orphanKeys) {
    facts.push(side.required
      ? { tone: "bad", text: `${fmt(side.orphanKeys)} keys (${fmt(side.orphanRows)} rows) find no match in ${otherTable}` }
      : { tone: "info", text: `${fmt(side.orphanKeys)} keys have no partner in ${otherTable}; nothing requires one` });
  }
  if (side.repeatedKeys) {
    facts.push(side.uniqueExpected
      ? { tone: "warn", text: `${fmt(side.repeatedKeys)} keys appear more than once (up to ${fmt(side.maxRowsPerKey)} rows)` }
      : { tone: "info", text: `keys repeat (up to ${fmt(side.maxRowsPerKey)} rows per key), as this join expects` });
  }
  if (!facts.length && (side.required || side.uniqueExpected))
    facts.push({ tone: "ok", text: side.required ? "every key finds a match" : "every key is unique" });
  return facts;
}

function SideCard({ side, otherTable }: { side: JoinSide; otherTable: string }) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold">
          {side.table}.{side.keys.replaceAll("_norm", "")}
        </span>
        <Pill tone={JOIN_STATUS[side.status].tone}>{JOIN_STATUS[side.status].label}</Pill>
      </div>
      {side.filter && <p className="font-mono text-[11px] text-muted-foreground">where {side.filter}</p>}
      <div className="space-y-1">
        <Metric label="Rows" value={fmt(side.rows)} />
        <Metric label="Distinct keys" value={fmt(side.distinctKeys)} />
        <Metric label="Most rows on one key" value={fmt(side.maxRowsPerKey)} />
      </div>
      <ul className="space-y-1">
        {sideFacts(side, otherTable).map((f) => (
          <li key={f.text} className="flex items-start gap-2 text-xs">
            <Dot tone={f.tone} className="mt-1" />
            {f.text}
          </li>
        ))}
      </ul>
      {side.required && side.sampleOrphans && (
        <p className="text-[11px] text-muted-foreground">
          e.g. <span className="font-mono break-all">{side.sampleOrphans}</span>
        </p>
      )}
      {side.uniqueExpected && side.sampleRepeated && (
        <p className="text-[11px] text-muted-foreground">
          repeated, e.g. <span className="font-mono break-all">{side.sampleRepeated}</span>
        </p>
      )}
    </div>
  );
}

function EdgeDetails({ data, id, onSelect }: { data: MapData; id: string; onSelect: Props["onSelect"] }) {
  const edge = data.edges.find((e) => e.id === id);
  if (!edge) return null;
  const joins = [...new Set(data.health.filter((h) => h.edgeId === id).map((h) => h.joinId))];
  return (
    <div className="space-y-4 p-5">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {edge.handoff !== null ? <span>Handoff #{edge.handoff}</span> : <span>{edge.kind}</span>}
          {edge.inferred && <Pill tone="info">inferred</Pill>}
          <Pill tone={JOIN_STATUS[edge.status].tone}>{JOIN_STATUS[edge.status].label}</Pill>
        </div>
        <h2 className="text-lg font-semibold">{edge.label}</h2>
        {edge.plain && <p className="pt-0.5 text-sm leading-relaxed">{edge.plain}</p>}
      </div>
      <CountsLine
        counts={countsFor(data.register, "edge", id)}
        empty="No finding counts on this line itself; the tables it joins may carry some."
      />
      <div className="divide-y border-y">
        <FoundHere data={data} kind="edge" id={id} onSelect={onSelect} />
        <Fold title="Who owns this">
          <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-3 rounded-xl bg-block p-3.5 text-sm">
            {edge.handoff !== null && (
              <>
                <dt className="text-muted-foreground">Owner</dt>
                <dd className="font-medium">
                  {edge.owner} · {edge.checkOffice}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Connects</dt>
            <dd>
              {label(data, edge.source)} <ArrowRight className="inline size-3.5" /> {label(data, edge.target)}
            </dd>
          </dl>
        </Fold>
        <Fold title="Raw key counts (technical)">
          <Section title="Expected (Dataset Guide §2)">
            <p className="text-sm">{edge.expected}</p>
          </Section>
          {joins.map((joinId) => {
            const sides = data.health.filter((h) => h.joinId === joinId);
            const left = sides.find((s) => s.side === "left")!, right = sides.find((s) => s.side === "right")!;
            return (
              <Section key={joinId} title="Observed in the raw keys" aside={<span className="text-xs">{left.observedCardinality}</span>}>
                <p className="text-sm text-muted-foreground">{left.joinLabel}</p>
                <SideCard side={left} otherTable={right.table} />
                <SideCard side={right} otherTable={left.table} />
              </Section>
            );
          })}
        </Fold>
        <Fold title="Rules (technical)">
          <RulesList ruleIds={edge.rules} catalog={data.catalog} register={data.register} />
        </Fold>
      </div>
      <Note />
    </div>
  );
}

function Note() {
  return (
    <p className="flex gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      Key counts describe the raw data, before the deliverable notebook&apos;s cleaning. Findings and their counts come from
      that notebook&apos;s register; this app detects nothing itself.
    </p>
  );
}
