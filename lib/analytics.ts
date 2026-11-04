/**
 * Google Analytics 4 through Google Tag Manager, on RoveHQ's own pages only (4 Nov 2026).
 *
 * - Container GTM-NX2B3BSS; the GA4 tag (G-1NGPP6YDZN) is set up inside GTM, so the code loads GTM and nothing else.
 * - Only on the production hosts below: rovehq.io (website) and rovehq.app (platform). Never on businesses' booking
 *   pages (theirshop.rovehq.app, their own domains, rovehq.app/rent, /book, /amend), the embedded checkout (an iframe
 *   of /rent/<slug>), the rove.rent marketplace, previews or localhost. Renters' data belongs to the businesses.
 * - "Basic" Consent Mode: GTM is not loaded at all until the visitor accepts analytics cookies (lib/consent.ts).
 * - Nothing personal is ever pushed (no email, name, phone, business name or user id).
 *
 * - rove.rent (4 Nov 2026): its own container GTM-NZL8J5FN (its own GA4 property), on the directory search page only
 *   (rove.rent/ and /rent). Each business's booking page there (rove.rent/<their-name>) is the business's, not tracked.
 *
 * Local testing only: NEXT_PUBLIC_GTM_ALLOW_LOCAL=1 also allows localhost / 127.0.0.1 / site.localhost. Never set it
 * on Vercel.
 */

export const GTM_ID = "GTM-NX2B3BSS";
/** The GA4 property GTM sends to: used for Google's per-page off switch (window["ga-disable-<id>"]). */
export const GA_MEASUREMENT_ID = "G-1NGPP6YDZN";

const PRODUCTION_HOSTS = new Set(["rovehq.io", "www.rovehq.io", "rovehq.app"]);
/** The renter marketplace: its own container and GA4 property. */
export const RENTER_GTM_ID = "GTM-NZL8J5FN";
/** Its GA4 property's measurement ID, for Google's per-page off switch. */
export const RENTER_GA_MEASUREMENT_ID = "G-8C2SZKPW8J";
const RENTER_HOSTS = new Set(["rove.rent", "www.rove.rent"]);

export function isRenterAnalyticsHost(hostname: string) {
  return RENTER_HOSTS.has(hostname.toLowerCase());
}

/** The container for this host. */
export function gtmIdFor(hostname: string) {
  return isRenterAnalyticsHost(hostname) ? RENTER_GTM_ID : GTM_ID;
}

/** The GA4 measurement ID behind this host's container (empty when not known). */
export function gaIdFor(hostname: string) {
  return isRenterAnalyticsHost(hostname) ? RENTER_GA_MEASUREMENT_ID : GA_MEASUREMENT_ID;
}
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "site.localhost"]);

/** Whether this host may load GTM at all. */
export function isTrackedHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (PRODUCTION_HOSTS.has(host) || RENTER_HOSTS.has(host)) return true;
  return process.env.NEXT_PUBLIC_GTM_ALLOW_LOCAL === "1" && LOCAL_HOSTS.has(host);
}

/** Customer pages (a business's booking page, the directory, booking links, changes): never tracked. */
export function isUntrackedPath(pathname: string, hostname = "") {
  // On rove.rent only the directory search is ours; everything else there is a business's page or a booking link.
  if (isRenterAnalyticsHost(hostname)) return !(pathname === "/" || pathname === "/rent");
  return pathname === "/rent" || pathname.startsWith("/rent/") || pathname === "/book" || pathname.startsWith("/book/") || pathname.startsWith("/amend/");
}

/**
 * A sign-up or sign-in that finished on the server (a server action that then redirects) leaves this short-lived
 * cookie, only when the browser has already accepted analytics (app/actions/auth.ts); the next page reads it once,
 * pushes the event and deletes it. It holds only the event's name and method, e.g. "sign_up:email": nothing about
 * the person.
 */
export const PENDING_EVENT_COOKIE = "rovehq_event";
export const PENDING_EVENT_MAX_AGE = 30 * 60;
export type PendingEvent = "sign_up" | "login";
export type PendingMethod = "email";
