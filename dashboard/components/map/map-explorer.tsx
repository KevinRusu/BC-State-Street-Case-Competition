"use client";

import { useState } from "react";
import { Graph, type Selection } from "@/components/flow/graph";
import { Switch } from "@/components/ui/switch";
import { Dot } from "@/components/common";
import { JOIN_STATUS } from "@/lib/status";
import type { MapData, Status } from "@/lib/types";
import { DetailsPanel } from "./details-panel";

export function MapExplorer({ data }: { data: MapData }) {
  const [selection, setSelection] = useState<Selection>(null);
  const [showLookups, setShowLookups] = useState(false);
  const [animate, setAnimate] = useState(true);
  const selectedLookup = selection?.kind === "edge" && data.edges.find((e) => e.id === selection.id)?.kind === "lookup";

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b px-5 py-3">
          <div>
            <h1 className="text-lg font-semibold">How data moves through the platform</h1>
            <p className="text-sm text-muted-foreground">
              Ten tables in three offices. Arrows are joins; colour is the health of their raw keys.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="hidden items-center gap-3 text-xs text-muted-foreground xl:flex">
              {(["ok", "fan_out", "orphans", "info"] as Status[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <Dot tone={JOIN_STATUS[s].tone} /> {JOIN_STATUS[s].label}
                </span>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <Switch checked={animate} onCheckedChange={setAnimate} /> Animate flow
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={showLookups || selectedLookup} onCheckedChange={setShowLookups} /> Show lookups
            </label>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <Graph
            data={data}
            showLookups={showLookups || selectedLookup}
            animate={animate}
            selection={selection}
            onSelect={setSelection}
          />
        </div>
      </div>
      <aside className="hidden w-[400px] shrink-0 overflow-y-auto border-l lg:block">
        <DetailsPanel data={data} selection={selection} onSelect={setSelection} />
      </aside>
    </div>
  );
}
