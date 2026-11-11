import type { Part } from "@/lib/executive-types";

/** Stands in for a part of the page whose table the store lacks; the rest of the page still renders. */
export function PartMissing({ part }: { part: Part }) {
  return (
    <div role="note" data-testid={`missing-${part}`} className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
      This part needs a rebuilt store: <span className="font-mono">uv run python scripts/build_store.py</span>
    </div>
  );
}
