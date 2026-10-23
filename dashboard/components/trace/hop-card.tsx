"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Pill } from "@/components/common";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HOP_STATUS, fmt, toneColor } from "@/lib/status";
import type { Hop } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXPECTED = { one: "expected one", one_or_more: "expected at least one", any: "any number" };

/** One step of a trace: what it looked for, how many rows it found, and those rows as raw text. */
export function HopCard({ hop, step }: { hop: Hop; step: number }) {
  const [open, setOpen] = useState(hop.status !== "info" && hop.total > 0 && hop.total <= 5);
  const meta = HOP_STATUS[hop.status];
  const color = toneColor(meta.tone);
  return (
    <li data-hop-table={hop.table} className="scroll-mt-4 overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => hop.rows.length && setOpen(!open)}
        className={cn("flex w-full items-start gap-3 px-4 py-3 text-left", hop.rows.length && "hover:bg-muted/50")}
      >
        <span
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ background: color }}
        >
          {step}
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-medium">{hop.title}</span>
            <span className="font-mono text-xs text-muted-foreground">{hop.table}</span>
          </span>
          {hop.via && <span className="block font-mono text-xs break-all text-muted-foreground">{hop.via}</span>}
          {hop.note && (
            <span className="block text-sm" style={{ color }}>
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
        <div className="border-t">
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
    </li>
  );
}
