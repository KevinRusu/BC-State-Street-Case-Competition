import { Suspense } from "react";
import { MapExplorer } from "@/components/map/map-explorer";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { StoreMissing } from "@/components/shell/store-missing";
import { loadMap } from "@/lib/data";

export default function MapPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MapContent />
    </Suspense>
  );
}

async function MapContent() {
  const map = await loadMap();
  if (!map.ok) return <StoreMissing file={map.file} />;
  return <MapExplorer data={map.data} />;
}
