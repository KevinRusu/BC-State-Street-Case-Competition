"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, Network, Route, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShell } from "./shell-state";

export const PAGES = [
  { href: "/", label: "Data map", icon: Network, hint: "tables, joins, rules" },
  { href: "/trace", label: "Trace a record", icon: Route, hint: "follow one ID end to end" },
];
const LATER = [
  { label: "Executive view", icon: LayoutDashboard },
  { label: "Monitoring", icon: Activity },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { menuOpen } = useShell();
  return (
    <aside className={cn("hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground", menuOpen && "md:flex")}>
      <div className="flex items-center gap-2.5 border-b px-4 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-brand text-white">
          <Workflow className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Data Flow Explorer</div>
          <div className="text-xs text-muted-foreground">team MVP · local only</div>
        </div>
      </div>
      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 p-3">
        {PAGES.map(({ href, label, icon: Icon, hint }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-start gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60",
              )}
            >
              <Icon className={cn("mt-0.5 size-4", active && "text-brand-line")} />
              <span className="flex flex-col">
                {label}
                <span className="text-xs font-normal text-muted-foreground">{hint}</span>
              </span>
            </Link>
          );
        })}
        <div className="mt-5 px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Coming at Check-in 3
        </div>
        {LATER.map(({ label, icon: Icon }) => (
          <div
            key={label}
            aria-disabled
            className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/70"
          >
            <Icon className="size-4" />
            {label}
          </div>
        ))}
      </nav>
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        Confidential data. Runs on 127.0.0.1 only; never deploy.
      </div>
    </aside>
  );
}
