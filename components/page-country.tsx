"use client";

import type { ReactNode } from "react";
import { rememberPageCountry } from "@/lib/business-units";

/**
 * Customer pages (the booking page, a booking link): the business's country for the client components below, so
 * their dates are written the business's way ("Nov 7" in the US, "7 Nov" elsewhere) the same on the server and in
 * the browser. The root layout can't know the business on these pages, so it records no country.
 */
export function PageCountry({ country, children }: { country: string | null | undefined; children: ReactNode }) {
  rememberPageCountry(country);
  return <>{children}</>;
}
