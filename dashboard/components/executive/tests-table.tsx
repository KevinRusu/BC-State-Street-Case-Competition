import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtCount } from "@/lib/executive";
import type { TestScore } from "@/lib/executive-types";
import { ScoreTrio } from "./score-trio";

const N = "font-mono tabular-nums";

/** One line per test of a rule, its counts in the test's own unit kind (never added across tests). */
export function TestsTable({ tests }: { tests: TestScore[] }) {
  if (tests.length === 0) return <p className="text-sm text-muted-foreground">This rule has no scored test.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Test</TableHead>
          <TableHead>Unit kind</TableHead>
          <TableHead>Score, coverage, confirmed only</TableHead>
          <TableHead>Population</TableHead>
          <TableHead>Evaluable</TableHead>
          <TableHead>Passed</TableHead>
          <TableHead>Confirmed fails</TableHead>
          <TableHead>Unresolved fails</TableHead>
          <TableHead>Cleared</TableHead>
          <TableHead>Not evaluable</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tests.map((t) => (
          <TableRow key={t.test} data-testid="test-row">
            <TableCell className="font-mono text-xs">{t.test}</TableCell>
            <TableCell>{t.unitKind}</TableCell>
            <TableCell><ScoreTrio trio={t} /></TableCell>
            <TableCell className={N}>{fmtCount(t.population)}</TableCell>
            <TableCell className={N}>{fmtCount(t.evaluable)}</TableCell>
            <TableCell className={N}>{fmtCount(t.passed)}</TableCell>
            <TableCell className={N}>{fmtCount(t.failedConfirmed)}</TableCell>
            <TableCell className={N}>{fmtCount(t.failedUnresolved)}</TableCell>
            <TableCell className={N}>{fmtCount(t.cleared)}</TableCell>
            <TableCell className={N}>{fmtCount(t.notEvaluable)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
