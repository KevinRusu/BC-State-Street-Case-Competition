import Link from "next/link";
import { fmtCount, PAGE_SIZE } from "@/lib/executive";

const LINK = "rounded-lg border px-2.5 py-1 text-sm text-brand-line hover:bg-muted";
const OFF = "rounded-lg border border-transparent px-2.5 py-1 text-sm text-muted-foreground";

/** "Previous" / "Next" and which rows are shown. `page` and `pages` come from the read, which clamps them. */
export function Pager({
  page, pages, total, hrefFor,
}: { page: number; pages: number; total: number; hrefFor: (page: number) => string }) {
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground" data-testid="pager-range">
        {total === 0 ? "No rows" : `rows ${fmtCount(first)}–${fmtCount(last)} of ${fmtCount(total)}`}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? <Link href={hrefFor(page - 1)} className={LINK}>Previous</Link> : <span className={OFF}>Previous</span>}
        <span className="text-sm text-muted-foreground">page {fmtCount(page)} of {fmtCount(Math.max(pages, 1))}</span>
        {page < pages ? <Link href={hrefFor(page + 1)} className={LINK}>Next</Link> : <span className={OFF}>Next</span>}
      </div>
    </nav>
  );
}
