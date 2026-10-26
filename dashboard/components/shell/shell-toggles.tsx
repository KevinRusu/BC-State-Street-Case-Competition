"use client";

import { usePathname } from "next/navigation";
import { PanelLeft, PanelRight } from "lucide-react";
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

/** Only the data map has a right-hand panel. */
export function PanelToggle() {
  const { panelOpen, togglePanel } = useShell();
  if (usePathname() !== "/") return null;
  return (
    <Button variant="ghost" size="icon" aria-label={panelOpen ? "Hide the panel" : "Show the panel"} aria-pressed={!panelOpen} onClick={togglePanel}>
      <PanelRight />
    </Button>
  );
}
