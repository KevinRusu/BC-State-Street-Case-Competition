import { Database, TriangleAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { loadStoreInfo } from "@/lib/data";

/** Which run the app shows: the store's build time and the register checksum (same as docs/FINDINGS.md). When the
 * register on disk has changed since the build, say so in plain sight: the page would show an older run. */
export async function StoreBadge() {
  const loaded = await loadStoreInfo();
  if (!loaded.ok) return <span className="text-xs text-status-bad">no store built</span>;
  const info = loaded.data;
  const stale = info.registerState === "stale";
  const unverified = info.registerState === "missing" && Boolean(info.registerChecksum);
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
        {stale && (
          <span className="flex items-center gap-1 font-medium" style={{ color: "var(--status-warn-text)" }} data-testid="store-stale">
            <TriangleAlert className="size-3.5" /> out of date
          </span>
        )}
        {unverified && <span data-testid="store-unverified">· unverified</span>}
      </TooltipTrigger>
      <TooltipContent>
        {unverified && <>The register this store copied is not on disk, so whether the store is current cannot be checked. </>}
        {stale && (
          <>
            The register in outputs/ is now {info.registerChecksumNow}; this store copied {info.registerChecksum}, so
            the pages show an older run. Rebuild with scripts/build_store.py.{" "}
          </>
        )}
        Built {info.builtAt.replace("T", " ")} · snapshot {info.snapshotDate} · manifest {info.manifestChecksum} · {info.registerLines} register lines. Rebuild
        with scripts/build_store.py after notebook 02.
      </TooltipContent>
    </Tooltip>
  );
}
