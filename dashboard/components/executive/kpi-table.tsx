import { Pill } from "@/components/common";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtValue, kpiAttainmentTone } from "@/lib/executive";
import type { Kpi } from "@/lib/executive-types";
import { TargetAttainment } from "./target-attainment";

function valueText(k: Kpi): string {
  const value = fmtValue(k.value, k.unit);
  if (k.value === null) return value;
  return k.unit === "%" ? `${value}%` : `${value} ${k.unit}`.trim();
}

export function KpiTable({ kpis }: { kpis: Kpi[] }) {
  const offices = [...new Set(kpis.map((k) => k.office))];
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="bg-block">
            <TableHead className="px-4">KPI</TableHead>
            <TableHead className="px-4 text-right">Value</TableHead>
            <TableHead className="px-4 text-right">Target</TableHead>
            <TableHead className="px-4">Attainment</TableHead>
            <TableHead className="px-4">Status</TableHead>
            <TableHead className="px-4">Owner</TableHead>
          </TableRow>
        </TableHeader>
        {offices.map((office) => (
          <TableBody key={office}>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <th scope="rowgroup" colSpan={6} className="px-4 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {office}
              </th>
            </TableRow>
            {kpis.filter((k) => k.office === office).map((k) => (
              <TableRow key={k.n} id={`kpi-${k.n}`} data-testid={`kpi-${k.n}`} title={k.formula} className="border-b last:border-b">
                <TableCell className="min-w-44 px-4 py-3 font-medium whitespace-normal">{k.kpi}</TableCell>
                <TableCell className="px-4 text-right font-mono font-semibold tabular-nums">{valueText(k)}</TableCell>
                <TableCell className="px-4 text-right tabular-nums text-muted-foreground">{k.target}</TableCell>
                <TableCell className="px-4"><TargetAttainment tone={kpiAttainmentTone(k)} /></TableCell>
                <TableCell className="px-4">
                  {k.status === "proposed" ? <Pill tone="info">Proposed</Pill> : (
                    <span className="text-xs font-medium text-muted-foreground capitalize">{k.status}</span>
                  )}
                </TableCell>
                <TableCell className="px-4 text-muted-foreground">{k.owner}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        ))}
      </Table>
    </div>
  );
}
