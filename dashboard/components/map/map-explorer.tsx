"use client";

import { useState } from "react";
import { Graph, type Selection } from "@/components/flow/graph";
import { useShell } from "@/components/shell/shell-state";
import { Switch } from "@/components/ui/switch";
import type { MapData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DetailsPanel } from "./details-panel";
import { SummaryCards } from "./summary-cards";

export function MapExplorer({ data }: { data: MapData }) {
  const [selection, setSelection] = useState<Selection>(null);
  const [showLookups, setShowLookups] = useState(false);
  // Off by default: moving dashes distract on a projector.
  const [animate, setAnimate] = useState(false);
  const { panelOpen } = useShell();
  const selectedLookup = selection?.kind === "edge" && data.edges.find((e) => e.id === selection.id)?.kind === "lookup";
  // A selected lookup keeps the lookups shown, so switching them off drops that selection too.
  const switchLookups = (on: boolean) => {
    setShowLookups(on);
    if (!on && selectedLookup) setSelection(null);
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
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
          </div>
        </div>
        <SummaryCards register={data.register} />
        {/* On short screens the page scrolls rather than shrinking the map below a readable size. */}
        <div className="min-h-[560px] flex-1">
          <Graph
            data={data}
            showLookups={showLookups || selectedLookup}
            animate={animate}
            selection={selection}
            onSelect={setSelection}
          />
        </div>
      </div>
      <aside className={cn("hidden w-[400px] shrink-0 overflow-y-auto border-l", panelOpen && "lg:block")}>
        <DetailsPanel data={data} selection={selection} onSelect={setSelection} />
      </aside>
    </div>
  );
}
