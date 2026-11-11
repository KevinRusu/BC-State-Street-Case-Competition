import { Fragment } from "react";
import { Dot, Pill } from "@/components/common";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BLANK, fmtValue } from "@/lib/executive";
import type { Kpi } from "@/lib/executive-types";

function valueText(k: Kpi): string {
  if (k.value === null) return fmtValue(k.value, k.unit);
  return `${fmtValue(k.value, k.unit)} ${k.unit}`.trim();
}

function Met({ met }: { met: string }) {
  const m = met.trim().toLowerCase();
  if (m !== "yes" && m !== "no") return <span className="text-muted-foreground">{BLANK}</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Dot tone={m === "yes" ? "ok" : "bad"} />
      {m}
    </span>
  );
}

/** The KPIs grouped by office; a row's formula is its tooltip. */
export function KpiTable({ kpis }: { kpis: Kpi[] }) {
  const offices = [...new Set(kpis.map((k) => k.office))];
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>KPI</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Target</TableHead>
          <TableHead>Met</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Owner</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {offices.map((office) => (
          <Fragment key={office}>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableCell colSpan={6} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {office}
              </TableCell>
            </TableRow>
            {kpis.filter((k) => k.office === office).map((k) => (
              <TableRow key={k.n} title={k.formula}>
                <TableCell className="whitespace-normal">{k.kpi}</TableCell>
                <TableCell className="font-mono tabular-nums">{valueText(k)}</TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">{k.target}</TableCell>
                <TableCell><Met met={k.met} /></TableCell>
                <TableCell><Pill tone="info">{k.status}</Pill></TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">{k.owner}</TableCell>
              </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
