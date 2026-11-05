import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { StoreMissing } from "@/components/shell/store-missing";
import { TraceView } from "@/components/trace/trace-view";
import { loadDemoTraces, loadMap, loadTrace } from "@/lib/data";

export const metadata: Metadata = { title: "Trace a record" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function TracePage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TraceContent searchParams={searchParams} />
    </Suspense>
  );
}

async function TraceContent({ searchParams }: Props) {
  const { id } = await searchParams;
  const query = typeof id === "string" ? id.trim() : "";
  const [map, demos, trace] = await Promise.all([loadMap(), loadDemoTraces(), query ? loadTrace(query) : null]);
  if (!map.ok) return <StoreMissing file={map.file} />;
  return (
    <TraceView
      map={map.data}
      demos={demos.ok ? demos.data : []}
      query={query}
      trace={trace?.ok ? trace.data : null}
    />
  );
}
