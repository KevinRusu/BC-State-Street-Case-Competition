"use client";

import { usePathname } from "next/navigation";
import { PAGES } from "./app-sidebar";

export function Breadcrumbs() {
  const pathname = usePathname();
  const page = PAGES.find((p) => (p.href === "/" ? pathname === "/" : pathname.startsWith(p.href)));
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Data Flow Explorer</span>
      {page && (
        <>
          <span className="text-muted-foreground/60">/</span>
          <span>{page.label}</span>
        </>
      )}
    </nav>
  );
}
