/**
 * Admin › Businesses (Rory, 7 Nov 2026): automatic segments worked out from each business, shown as filter chips next
 * to the manual tags the team adds ("test", "VIP"). Later the same segments pick who gets an email. Safe for client code.
 * Manual tags live in organizations.admin_tags (migration 0124_admin_business_tags.sql).
 */

export const ADMIN_SEGMENTS = [
  { key: "trial", label: "In trial" },
  { key: "trial_7", label: "Trial ends within 7 days" },
  { key: "free", label: "Free" },
  { key: "starter", label: "Starter" },
  { key: "pro", label: "Pro" },
  { key: "business", label: "Business" },
  { key: "cancelled", label: "Cancelled" },
  { key: "no_vehicles", label: "No vehicles" },
  { key: "inactive_14", label: "Inactive 14 days" }
] as const;
export type AdminSegment = (typeof ADMIN_SEGMENTS)[number]["key"];

const DAY = 86_400_000;

/** Which automatic segments a business is in today. */
export function segmentsOf(business: { status: string; tier: string; trialEndsAt: string | null; vehicles: number; lastActive: string | null; createdAt: string | null }, now = Date.now()): AdminSegment[] {
  const out: AdminSegment[] = [];
  if (business.status === "trial") {
    out.push("trial");
    const left = business.trialEndsAt ? Math.ceil((Date.parse(business.trialEndsAt) - now) / DAY) : null;
    if (left !== null && left <= 7) out.push("trial_7");
  }
  const tier = business.tier === "growth" ? "pro" : business.tier;
  if (tier === "free" || tier === "starter" || tier === "pro" || tier === "business") out.push(tier);
  if (business.status === "cancelled") out.push("cancelled");
  if (!business.vehicles) out.push("no_vehicles");
  // Nobody in the business has signed in for 14 days (one made in the last 14 days with no sign-in yet doesn't count).
  const seen = business.lastActive ? Date.parse(business.lastActive) : null;
  if (seen === null ? !business.createdAt || Date.parse(business.createdAt) < now - 14 * DAY : seen < now - 14 * DAY) out.push("inactive_14");
  return out;
}

/** A manual tag as stored: trimmed, lower case, letters, digits, spaces and dashes, at most 30 characters. */
export function cleanTag(tag: string) {
  return String(tag || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);
}

/** Tags read from the database column, tidied (a missing column reads as none). */
export function tagsFrom(value: unknown): string[] {
  return Array.isArray(value) ? Array.from(new Set(value.map((tag) => cleanTag(String(tag))).filter(Boolean))).sort() : [];
}
