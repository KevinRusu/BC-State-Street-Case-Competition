"use client";

import { createContext, useContext, useState } from "react";

// The header toggles the left menu and the Data Map details.
type Shell = { menuOpen: boolean; panelOpen: boolean; toggleMenu: () => void; togglePanel: () => void };

const ShellContext = createContext<Shell>({ menuOpen: true, panelOpen: true, toggleMenu: () => {}, togglePanel: () => {} });

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  return (
    <ShellContext.Provider
      value={{ menuOpen, panelOpen, toggleMenu: () => setMenuOpen((o) => !o), togglePanel: () => setPanelOpen((o) => !o) }}
    >
      {children}
    </ShellContext.Provider>
  );
}

export const useShell = () => useContext(ShellContext);
