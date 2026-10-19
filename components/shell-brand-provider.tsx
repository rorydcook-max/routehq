"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ShellBrand } from "@/lib/shell-brand";

// The operator's logo and name, worked out on the server for the root layout, so the shell paints
// their brand on the very first frame instead of RouteHQ's and then swapping a moment later.
const ShellBrandContext = createContext<ShellBrand | null>(null);

export function ShellBrandProvider({ brand, children }: { brand: ShellBrand | null; children: ReactNode }) {
  return <ShellBrandContext.Provider value={brand}>{children}</ShellBrandContext.Provider>;
}

export function useInitialShellBrand() {
  return useContext(ShellBrandContext);
}
