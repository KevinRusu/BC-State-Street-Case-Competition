"use client";

import { ArrowRight, Info } from "lucide-react";
import { CheckBadge, Dot, FindingDots, Metric, Pill, Section, SourceChip } from "@/components/common";
import { RulesList } from "@/components/rules-list";
import { edgeIssue, type Selection } from "@/components/flow/graph";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { countsFor } from "@/lib/findings";
import { JOIN_STATUS, fmt, toneText } from "@/lib/status";
import type { JoinSide, MapData, MapEdge, MapNode, Status } from "@/lib/types";

type Props = { data: MapData; selection: Selection; onSelect: (selection: Selection) => void };

export function DetailsPanel({ data, selection, onSelect }: Props) {
  if (selection?.kind === "node") return <NodeDetails data={data} id={selection.id} onSelect={onSelect} />;
  if (selection?.kind === "edge") return <EdgeDetails data={data} id={selection.id} />;
  return <Overview data={data} onSelect={onSelect} />;
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
    <div className="space-y-6 p-5">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">How to read the map</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A <b className="text-foreground">row</b> is the office that handles a table. Follow the{" "}
          <b className="text-foreground">columns</b> left to right to follow the data.{" "}
          <b className="text-brand-line">Blue numbers</b> are our checks; an arrow&apos;s colour is the health of its
          keys. Dashed: the data can&apos;t prove it. Click anything for details.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(["ok", "fan_out", "orphans", "info"] as Status[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5" title={JOIN_STATUS[s].meaning}>
              <Dot tone={JOIN_STATUS[s].tone} /> {JOIN_STATUS[s].label}
            </span>
          ))}
        </div>
      </div>
      <Section title="The checks, in flow order">
        <div className="-mx-2">
          {checks.map((edge) => (
            <JoinRow key={edge.id} data={data} edge={edge} onSelect={onSelect} detail={`${edge.owner} · ${edge.checkOffice}`} />
          ))}
        </div>
      </Section>
      <Section title="Other joins">
        <div className="-mx-2">
          {others.map((edge) => (
            <JoinRow key={edge.id} data={data} edge={edge} onSelect={onSelect} detail={route(data, edge)} />
          ))}
        </div>
      </Section>
      {unplaced.length > 0 && (
        <Section title="Register rules not on the map">
          <p className="font-mono text-xs">{unplaced.join(", ")}</p>
        </Section>
      )}
      <Note />
    </div>
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
    <div className="space-y-6 p-5">
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">{node.place}</div>
        <h2 className="text-lg font-semibold">{node.label}</h2>
        <p className="font-mono text-xs text-muted-foreground">{node.id}</p>
        <p className="text-sm italic">{node.grain}</p>
      </div>
      <Ownership node={node} />
      <Section title="Rows">
        <Metric label="Loaded (as text)" value={fmt(node.rows)} />
        <Metric
          label="Manifest says"
          value={fmt(node.manifestRows)}
          tone={node.rows === node.manifestRows ? "ok" : "bad"}
        />
        <Metric label="Columns" value={node.columns} />
        {node.unreadableDates && <Metric label="Unreadable dates" value={node.unreadableDates} tone="warn" />}
      </Section>
      <Section title="Joins">
        <div className="-mx-2">
          {joins.map((edge) => (
            <JoinRow key={edge.id} data={data} edge={edge} onSelect={onSelect} detail={route(data, edge)} />
          ))}
        </div>
      </Section>
      <Section title="Checks on this table">
        <RulesList ruleIds={node.rules} catalog={data.catalog} register={data.register} />
      </Section>
      <Collapsible>
        <CollapsibleTrigger className="text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground">
          Columns ({columns.length}) ▾
        </CollapsibleTrigger>
        <CollapsibleContent>
          <dl className="mt-3 space-y-2">
            {columns.map((c) => (
              <div key={c.column} className="text-xs">
                <dt className="font-mono font-medium">
                  {c.column} <span className="font-sans text-muted-foreground">· {c.intendedType}</span>
                </dt>
                <dd className="text-muted-foreground">{c.description}</dd>
              </div>
            ))}
          </dl>
        </CollapsibleContent>
      </Collapsible>
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

function EdgeDetails({ data, id }: { data: MapData; id: string }) {
  const edge = data.edges.find((e) => e.id === id);
  if (!edge) return null;
  const joins = [...new Set(data.health.filter((h) => h.edgeId === id).map((h) => h.joinId))];
  return (
    <div className="space-y-6 p-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {edge.handoff !== null ? <span>Handoff #{edge.handoff}</span> : <span>{edge.kind}</span>}
          {edge.inferred && <Pill tone="info">inferred</Pill>}
          <Pill tone={JOIN_STATUS[edge.status].tone}>{JOIN_STATUS[edge.status].label}</Pill>
        </div>
        <h2 className="text-lg font-semibold">{edge.label}</h2>
        {edge.handoff !== null && (
          <p className="text-sm">
            <span className="text-muted-foreground">Owner:</span> {edge.owner} · {edge.checkOffice}
          </p>
        )}
        <p className="text-sm">
          {label(data, edge.source)} <ArrowRight className="inline size-3.5" /> {label(data, edge.target)}
        </p>
      </div>
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
      <Section title="Checks on this join">
        <RulesList ruleIds={edge.rules} catalog={data.catalog} register={data.register} />
      </Section>
      <Note />
    </div>
  );
}

function Note() {
  return (
    <p className="flex gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      Key counts describe the raw data, before notebook 02&apos;s cleaning. Findings and their counts come from notebook
      02&apos;s register; this app detects nothing itself.
    </p>
  );
}
