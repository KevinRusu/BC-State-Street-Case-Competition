"use client";

import { usePathname } from "next/navigation";
import { PAGES } from "./app-sidebar";

export function Breadcrumbs() {
  const pathname = usePathname();
  const page = PAGES.find((p) => (p.href === "/" ? pathname === "/" : pathname.startsWith(p.href)));
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 overflow-hidden text-sm">
      <span className="hidden whitespace-nowrap text-muted-foreground sm:inline">Data Flow Explorer</span>
      {page && (
        <>
          <span className="hidden text-muted-foreground/60 sm:inline">/</span>
          <span className="truncate">{page.label}</span>
        </>
      )}
    </nav>
  );
}
