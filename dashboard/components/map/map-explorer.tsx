"use client";

import { ArrowUp } from "lucide-react";
import { useRef, useState } from "react";
import { Graph, type Selection } from "@/components/flow/graph";
import { useShell } from "@/components/shell/shell-state";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { MapData } from "@/lib/types";
import { DetailsPanel } from "./details-panel";
import { SummaryCards } from "./summary-cards";

function reveal(section: HTMLElement | null) {
  section?.focus({ preventScroll: true });
  section?.scrollIntoView({ block: "start" });
}

export function MapExplorer({ data }: { data: MapData }) {
  const [selection, setSelection] = useState<Selection>(null);
  const [showLookups, setShowLookups] = useState(false);
  // Off by default: moving dashes distract on a projector.
  const [animate, setAnimate] = useState(false);
  const { panelOpen } = useShell();
  const canvas = useRef<HTMLDivElement>(null);
  const details = useRef<HTMLElement>(null);
  const selectedLookup = selection?.kind === "edge" && data.edges.find((e) => e.id === selection.id)?.kind === "lookup";
  // A selected lookup keeps the lookups shown, so switching them off drops that selection too.
  const switchLookups = (on: boolean) => {
    setShowLookups(on);
    if (!on && selectedLookup) setSelection(null);
  };
  const selectFromDetails = (next: Selection, showOnMap = false) => {
    setSelection(next);
    if (showOnMap) reveal(canvas.current);
    else if (next && panelOpen) reveal(details.current);
  };

  return (
    <div data-map-layout className="@container min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 @min-[52rem]:min-h-[calc(100dvh-5.5rem)]">
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">How data moves through the platform</h1>
            <p className="text-sm text-muted-foreground">
              Rows: the office that handles each table. Columns: the data&apos;s path, from the address books to the NAV.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              <Switch checked={showLookups || selectedLookup} onCheckedChange={switchLookups} /> Show lookups
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={animate} onCheckedChange={setAnimate} /> Animate flow
            </label>
            {panelOpen && <Button variant="outline" size="sm" onClick={() => reveal(details.current)}>View details</Button>}
          </div>
        </div>
        <div className="grid flex-1 items-start gap-4 @min-[52rem]:grid-cols-[minmax(0,1fr)_clamp(9rem,15cqw,12rem)]">
          <div
            ref={canvas}
            role="region"
            aria-label="Data map"
            tabIndex={-1}
            className="h-[clamp(17rem,64cqw,35rem)] min-w-0 scroll-mt-4 overflow-hidden rounded-xl border focus:outline-none @min-[52rem]:h-auto @min-[52rem]:min-h-[32rem] @min-[52rem]:self-stretch"
          >
            <Graph
              data={data}
              showLookups={showLookups || selectedLookup}
              animate={animate}
              selection={selection}
              onSelect={setSelection}
            />
          </div>
          <SummaryCards register={data.register} />
        </div>
      </div>
      <section
        id="data-map-details"
        ref={details}
        aria-label="Map details"
        tabIndex={-1}
        hidden={!panelOpen}
        className="min-w-0 scroll-mt-4 rounded-xl border focus:outline-none"
      >
        <div className="flex justify-end border-b px-4 py-2">
          <Button variant="ghost" size="sm" onClick={() => reveal(canvas.current)}><ArrowUp /> Back to map</Button>
        </div>
        <DetailsPanel data={data} selection={selection} onSelect={selectFromDetails} />
      </section>
    </div>
  );
}
