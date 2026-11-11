import Link from "next/link";
import { fmtCount, RESULT_TONE, RESULTS } from "@/lib/executive";
import type { RecordFilter, Result } from "@/lib/executive-types";
import { toneColor, toneText } from "@/lib/status";

/** "All n" and one chip per result that has records. Each link keeps the other filters and resets the page. */
export function ResultChips({
  counts, filter, hrefFor,
}: { counts: Record<Result, number>; filter: RecordFilter; hrefFor: (f: RecordFilter) => string }) {
  const all = RESULTS.reduce((sum, r) => sum + counts[r], 0);
  const base = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm";
  return (
    <nav aria-label="Filter by result" className="flex flex-wrap gap-2">
      <Link
        href={hrefFor({ ...filter, result: undefined, page: undefined })}
        aria-current={filter.result === undefined ? "true" : undefined}
        className={`${base} hover:bg-muted ${filter.result === undefined ? "border-brand-line font-semibold text-brand-line" : ""}`}
      >
        All <span className="font-mono tabular-nums">{fmtCount(all)}</span>
      </Link>
      {RESULTS.filter((r) => counts[r] > 0).map((r) => {
        const color = toneColor(RESULT_TONE[r]);
        const active = filter.result === r;
        return (
          <Link
            key={r}
            href={hrefFor({ ...filter, result: r, page: undefined })}
            aria-current={active ? "true" : undefined}
            className={`${base} ${active ? "font-semibold" : ""}`}
            style={{
              color: toneText(RESULT_TONE[r]),
              borderColor: `color-mix(in oklab, ${color} ${active ? 80 : 35}%, transparent)`,
              background: `color-mix(in oklab, ${color} ${active ? 20 : 8}%, transparent)`,
            }}
          >
            {r} <span className="font-mono tabular-nums">{fmtCount(counts[r])}</span>
          </Link>
        );
      })}
    </nav>
  );
}
