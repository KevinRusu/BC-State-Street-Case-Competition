"use client";

import { usePathname } from "next/navigation";
import { PanelBottom, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShell } from "./shell-state";

export function MenuToggle() {
  const { menuOpen, toggleMenu } = useShell();
  return (
    <Button variant="ghost" size="icon" aria-label={menuOpen ? "Hide the menu" : "Show the menu"} aria-pressed={!menuOpen} onClick={toggleMenu}>
      <PanelLeft />
    </Button>
  );
}

/** The Data Map has a details panel below its canvas. */
export function PanelToggle() {
  const { panelOpen, togglePanel } = useShell();
  if (usePathname() !== "/") return null;
  return (
    <Button variant="ghost" size="icon" aria-label={panelOpen ? "Hide the panel" : "Show the panel"} aria-controls="data-map-details" aria-expanded={panelOpen} onClick={togglePanel}>
      <PanelBottom />
    </Button>
  );
}
