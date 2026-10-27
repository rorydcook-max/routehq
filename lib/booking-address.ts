import { effectiveLimits, planById } from "@/lib/plans";

/**
 * A business's booking address (Rory, 11 Oct 2026):
 * - routehq.app/rent/<slug>: every business, always works (the directory links here);
 * - <theirshop>.routehq.app: Pro and above;
 * - their own domain, e.g. book.theirshop.com: Business plan.
 * Pure: used by the middleware (edge) as well as pages.
 */

export const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "api", "admin", "help", "support", "mail", "email", "smtp", "rent", "book", "booking", "bookings", "static", "assets", "cdn",
  "dev", "staging", "test", "demo", "status", "blog", "docs", "routehq", "team", "login", "signup", "account", "billing", "partners", "directory"
]);

/** Vercel's address for a domain pointed at the project. */
export const DNS_CNAME_TARGET = "cname.vercel-dns.com";
export const DNS_A_TARGET = "76.76.21.21";

export function rootDomain() {
  return String(process.env.NEXT_PUBLIC_ROOT_DOMAIN || "routehq.app").toLowerCase().replace(/^www\./, "");
}

export function cleanSubdomain(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

/** While typing: same rules, but a dash at the end stays so "phuket-easy" can be typed. */
export function typingSubdomain(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .slice(0, 30);
}

export type SubdomainProblem = "short" | "chars" | "reserved" | null;
export function subdomainProblem(value: string): SubdomainProblem {
  if (value.length < 3) return "short";
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value)) return "chars";
  if (RESERVED_SUBDOMAINS.has(value)) return "reserved";
  return null;
}

/** "https://Book.MyShop.com/path" → "book.myshop.com"; null when it isn't a usable domain. */
export function cleanDomain(value: string) {
  const host = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(host)) return null;
  const root = rootDomain();
  if (host === root || host.endsWith(`.${root}`) || host.endsWith(".vercel.app")) return null;
  return host;
}

/** An apex domain (theirshop.com) needs an A record; anything under it (book.theirshop.com) a CNAME. */
export function isApexDomain(host: string) {
  const parts = host.split(".");
  // Thai second-level domains: theirshop.co.th is an apex too.
  if (parts.length === 3 && /^(co|or|in|ac|go|net|com|org)$/.test(parts[1]) && parts[2].length === 2) return true;
  return parts.length === 2;
}

// custom_limits: an admin-set custom plan can switch the own-domain feature on or off for one business.
type Plan = { subscription_tier?: string | null; subscription_status?: string | null; custom_limits?: unknown };
const onTrial = (org: Plan) => String(org.subscription_status || "trial") === "trial";
export const canUseSubdomain = (org: Plan) => onTrial(org) || planById(org.subscription_tier).whiteLabel;
export const canUseOwnDomain = (org: Plan) => onTrial(org) || effectiveLimits(org).customDomain;

function appUrl() {
  return String(process.env.NEXT_PUBLIC_APP_URL || `https://${rootDomain()}`).replace(/\/$/, "");
}

/** The address of a subdomain, on whatever host the app runs (`lamai.localhost:3000` in development). */
export function subdomainUrl(label: string) {
  try {
    const app = new URL(appUrl());
    if (app.hostname === "localhost" || app.hostname.endsWith(".localhost")) return `${app.protocol}//${label}.localhost${app.port ? `:${app.port}` : ""}`;
  } catch {
    // Fall through to the live address.
  }
  return `https://${label}.${rootDomain()}`;
}

export type BookingAddressOrg = Plan & { slug: string; booking_subdomain?: string | null; custom_domain?: string | null; custom_domain_status?: string | null };

/** The address to share: their own domain once it works, else their subdomain, else the RouteHQ path. */
export function bookingAddress(org: BookingAddressOrg): { url: string; kind: "domain" | "subdomain" | "path" } {
  if (org.custom_domain && org.custom_domain_status === "live" && canUseOwnDomain(org)) return { url: `https://${org.custom_domain}`, kind: "domain" };
  if (org.booking_subdomain && canUseSubdomain(org)) return { url: subdomainUrl(org.booking_subdomain), kind: "subdomain" };
  return { url: `${appUrl()}/rent/${org.slug}`, kind: "path" };
}

/**
 * What a request's host asks for: a subdomain label, a business's own domain, or nothing (the app itself).
 * Used by the middleware.
 */
export function hostTarget(rawHost: string | null | undefined): { label: string } | { host: string } | null {
  const host = String(rawHost || "").toLowerCase().replace(/:\d+$/, "");
  if (!host || host === "localhost" || !host.includes(".") || /^[\d.]+$/.test(host) || host.startsWith("[")) return null;
  const root = rootDomain();
  if (host === root || host === `www.${root}` || host.endsWith(".vercel.app")) return null;
  for (const base of [root, "localhost"]) {
    if (host.endsWith(`.${base}`)) {
      const label = host.slice(0, -(base.length + 1));
      if (!label || label.includes(".") || RESERVED_SUBDOMAINS.has(label)) return null;
      return { label };
    }
  }
  return { host };
}

/** Paths that keep working on a booking address; anything else belongs to the app. */
export function isBookingSitePath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/rent" ||
    pathname.startsWith("/rent/") ||
    pathname.startsWith("/book/") ||
    pathname.startsWith("/amend/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/fonts/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/icon.svg" ||
    pathname === "/robots.txt"
  );
}
