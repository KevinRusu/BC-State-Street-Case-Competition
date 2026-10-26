"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Pill } from "@/components/common";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HOP_STATUS, fmt, toneColor, toneText } from "@/lib/status";
import type { Hop } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXPECTED = { one: "expected one", one_or_more: "expected at least one", any: "any number" };

/**
 * One step of a trace on the timeline: a ring in the colour of what it found, where the step sits on the map, the
 * join it used, how many rows it found, and those rows as raw text.
 */
export function TimelineStep({ hop, step, place, last }: { hop: Hop; step: number; place: string; last: boolean }) {
  const [open, setOpen] = useState(hop.status !== "info" && hop.total > 0 && hop.total <= 5);
  const meta = HOP_STATUS[hop.status];
  const color = hop.status === "not_reached" ? "var(--muted-foreground)" : toneColor(meta.tone);
  return (
    <li data-hop-table={hop.table} className="relative flex scroll-mt-4 gap-3.5 pb-3">
      {!last && <span className="absolute top-7 -bottom-1 left-[11px] w-0.5 bg-border" />}
      <span
        className="relative z-10 mt-2 flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-background text-[11px] font-bold"
        style={{ borderColor: color, color, ...(hop.status === "not_reached" ? { borderStyle: "dashed" } : {}) }}
      >
        {step}
      </span>
      <div className={cn("min-w-0 flex-1 overflow-hidden rounded-xl", hop.status === "missing" && "bg-block")}>
        <button
          type="button"
          onClick={() => hop.rows.length && setOpen(!open)}
          className={cn("flex w-full items-start gap-3 px-3 py-2 text-left", hop.rows.length && "rounded-xl hover:bg-block")}
        >
          <span className="min-w-0 flex-1 space-y-0.5">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold">{hop.title}</span>
              <span className="font-mono text-xs text-muted-foreground">{hop.table}</span>
            </span>
            <span className="block text-xs text-muted-foreground">{place}</span>
            {hop.via && <span className="block font-mono text-xs break-all text-muted-foreground">{hop.via}</span>}
            {hop.note && (
              <span className="block text-sm" style={{ color: toneText(meta.tone) }}>
                {hop.note}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-3">
            {hop.status !== "not_reached" && (
              <span className="text-right text-xs text-muted-foreground tabular-nums">
                {fmt(hop.total)} {hop.total === 1 ? "row" : "rows"}
                <br />
                {EXPECTED[hop.expected]}
              </span>
            )}
            <Pill tone={meta.tone}>{meta.label}</Pill>
            {hop.rows.length > 0 && <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />}
          </span>
        </button>
        {open && hop.rows.length > 0 && (
          <div className="mx-3 mb-2 overflow-hidden rounded-lg border bg-card">
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
    </li>
  );
}
