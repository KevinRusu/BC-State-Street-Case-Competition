import { Database } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { loadStoreInfo } from "@/lib/data";

/** Which run the app shows: the store's build time and the register checksum (same as docs/FINDINGS.md). */
export async function StoreBadge() {
  const loaded = await loadStoreInfo();
  if (!loaded.ok) return <span className="text-xs text-status-bad">no store built</span>;
  const info = loaded.data;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1 text-xs whitespace-nowrap text-muted-foreground" />
        }
      >
        <Database className="size-3.5" />
        <span className="sr-only lg:not-sr-only">store {info.builtAt.replace("T", " ")}</span>
        <span className="sr-only font-mono sm:not-sr-only">register {info.registerChecksum || "none"}</span>
      </TooltipTrigger>
      <TooltipContent>
        Built {info.builtAt.replace("T", " ")} · snapshot {info.snapshotDate} · manifest {info.manifestChecksum} · {info.registerLines} register lines. Rebuild
        with scripts/build_store.py after notebook 02.
      </TooltipContent>
    </Tooltip>
  );
}
