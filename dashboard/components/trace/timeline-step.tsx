"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Dot, RegisterStatus } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { findingText } from "@/lib/plain";
import { HOP_STATUS, fmt, toneColor, toneText } from "@/lib/status";
import { exampleEvidence, traceTone } from "@/lib/trace-findings";
import type { Hop, PlainText, RegisterMark } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXPECTED = { one: "expected one", one_or_more: "expected at least one", any: "any number" };

/**
 * One step of a trace on the timeline, as one line: a ring in the colour of what it found, the step's name and a
 * short word for its link. Steps with a finding start open and say it in plain words; the raw rows (as text) sit
 * behind one more click.
 */
export function TimelineStep({ hop, findings, step, place, last, query, plain, open, onOpenChange }: {
  hop: Hop; findings: RegisterMark[]; step: number; place: string; last: boolean; query: string; plain: PlainText;
  open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const [rawRows, setRawRows] = useState(false);
  const meta = HOP_STATUS[hop.status];
  const color = toneColor(traceTone(hop.status, findings));
  // Where the step sits, the join it used, what it noticed and how many rows it found, in that order.
  const facts: { text: string; className?: string; color?: string }[] = [
    { text: place },
    { text: hop.via, className: "font-mono break-all" },
    { text: hop.note, color: toneText(meta.tone) },
    { text: hop.status === "not_reached" ? "" : `${fmt(hop.total)} ${hop.total === 1 ? "row" : "rows"}, ${EXPECTED[hop.expected]}` },
  ].filter((fact) => fact.text);
  return (
    <li id={`trace-step-${hop.id}`} data-hop-table={hop.table} className="relative flex scroll-mt-4 gap-3.5 pb-1.5">
      {!last && <span className="absolute top-7 -bottom-1 left-[11px] w-0.5 bg-border" />}
      <span
        className="relative z-10 mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-background text-[11px] font-bold"
        style={{ borderColor: color, color, ...(hop.status === "not_reached" ? { borderStyle: "dashed" } : {}) }}
      >
        {step}
      </span>
      <div className={cn("min-w-0 flex-1 overflow-hidden rounded-xl", (open || hop.status === "missing") && "bg-block")}>
        <button
          type="button"
          id={`trace-step-${hop.id}-toggle`}
          aria-controls={`trace-step-${hop.id}-details`}
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-block"
        >
          <span className="min-w-0 truncate font-semibold" title={hop.table}>{hop.title}</span>
          <Dot tone={meta.tone} />
          <span title={meta.label} className="shrink-0 text-xs" style={{ color: toneText(meta.tone) }}>
            {meta.short}
          </span>
          <ChevronDown className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        <div id={`trace-step-${hop.id}-details`} hidden={!open}>
          {open && (
            <div className="space-y-2.5 px-3 pb-3">
              <p className="text-xs leading-relaxed break-words text-muted-foreground">
                {facts.map((fact, index) => (
                  <span key={index}>
                    {index > 0 && " · "}
                    <span className={fact.className} style={{ color: fact.color }}>{fact.text}</span>
                  </span>
                ))}
              </p>
              {findings.length > 0 && (
                <div className="space-y-2" aria-label="Findings at this step">
                  {findings.map((finding) => {
                    const evidence = exampleEvidence(hop, finding);
                    return (
                      <div key={`${finding.line}-${finding.recordId}`} className="space-y-1.5 rounded-lg border bg-card p-3">
                        <div className="flex items-start gap-2 text-sm">
                          <RegisterStatus status={finding.status} />
                          <span>{findingText(finding, query, plain)}</span>
                        </div>
                        {evidence.length > 0 && (
                          <div className="space-y-0.5">
                            <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Evidence</div>
                            {evidence.map((line, index) => (
                              <p key={index} className="font-mono text-xs break-words">{line}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {hop.rows.length > 0 && (
                <Button variant="ghost" size="sm" className="-ml-2" aria-expanded={rawRows} onClick={() => setRawRows(!rawRows)}>
                  {rawRows ? "Hide the raw rows" : "Show the raw rows"}
                  <ChevronDown className={cn("transition-transform", rawRows && "rotate-180")} />
                </Button>
              )}
            </div>
          )}
          {open && rawRows && hop.rows.length > 0 && (
            <div className="mx-3 mb-3 overflow-hidden rounded-lg border bg-card">
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      {hop.columns.map((c) => (
                        <TableHead key={c} className={cn("font-mono text-[11px]", c === "source_row" && "text-muted-foreground")}>
                          {c === "source_row" ? "row #" : c}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hop.rows.map((row, i) => (
                      <TableRow key={i}>
                        {hop.columns.map((c) => (
                          <TableCell key={c} className={cn("font-mono", c === "source_row" && "text-muted-foreground")}>
                            {row[c] ?? <span className="text-muted-foreground/60">blank</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {hop.total > hop.rows.length && (
                <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                  Showing the first {hop.rows.length} of {fmt(hop.total)} rows (file order).
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
