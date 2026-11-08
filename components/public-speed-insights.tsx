"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Real visitors' loading speed (Vercel Speed Insights; task perf2, 8 Nov 2026), on the public sites only: rovehq.io,
 * rove.rent and businesses' booking pages. It sets no cookies and stores nothing on the device, so it needs no
 * cookie consent (lib/consent.ts covers optional cookies: Google Analytics). Each report carries the page's address
 * without its query string or #hash (booking pages carry dates, partner references and searches there).
 * Reports only on Vercel, once Speed Insights is switched on for the project in Vercel's dashboard.
 */
export function PublicSpeedInsights() {
  return <SpeedInsights beforeSend={(event) => ({ ...event, url: event.url.split(/[?#]/)[0] })} />;
}
