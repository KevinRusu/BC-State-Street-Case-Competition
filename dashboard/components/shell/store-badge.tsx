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
          <span className="flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs text-muted-foreground" />
        }
      >
        <Database className="size-3.5" />
        <span>store {info.builtAt.replace("T", " ")}</span>
        <span className="font-mono">register {info.registerChecksum || "none"}</span>
      </TooltipTrigger>
      <TooltipContent>
        Snapshot {info.snapshotDate} · manifest {info.manifestChecksum} · {info.registerLines} register lines. Rebuild
        with scripts/build_store.py after notebook 02.
      </TooltipContent>
    </Tooltip>
  );
}
