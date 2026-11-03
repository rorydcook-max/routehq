"use client";

import { createContext, useContext, type ReactNode } from "react";
import { rememberPageTimeZone } from "@/lib/business-time";
import { rememberPageCurrency, rememberPageDistanceUnit } from "@/lib/business-units";
import type { ShellBrand } from "@/lib/shell-brand";

// The operator's logo and name, worked out on the server for the root layout, so the shell paints
// their brand on the very first frame instead of RoveHQ's and then swapping a moment later.
const ShellBrandContext = createContext<ShellBrand | null>(null);

/**
 * `timeZone`: the business's own clock (Europe/London...), recorded before any page below is drawn, so client
 * components' "today" and times follow it (lib/business-time.ts).
 */
export function ShellBrandProvider({
  brand,
  timeZone,
  distanceUnit,
  currency,
  children
}: {
  brand: ShellBrand | null;
  timeZone?: string | null;
  distanceUnit?: string | null;
  currency?: string | null;
  children: ReactNode;
}) {
  rememberPageTimeZone(timeZone);
  rememberPageDistanceUnit(distanceUnit);
  rememberPageCurrency(currency);
  return <ShellBrandContext.Provider value={brand}>{children}</ShellBrandContext.Provider>;
}

export function useInitialShellBrand() {
  return useContext(ShellBrandContext);
}
