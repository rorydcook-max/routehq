import { formatMoney as formatRegionalMoney } from "@/lib/regional";
import type { SiteSocial } from "@/lib/sites/config";

/** Small helpers the website's sections share. Safe to import from the browser. */

/** Prices the way the booking page writes them: ฿ for baht, the currency's own symbol otherwise. */
export function sitePrice(value: number, currency: string) {
  return currency === "THB" ? `฿${Math.round(value).toLocaleString("en-US")}` : formatRegionalMoney(value, currency, "en-GB");
}

/** A link for each social account, from what the owner typed (@name, a number, or a full address). */
export function socialHref(key: keyof SiteSocial, value: string) {
  const raw = value.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, "");
  switch (key) {
    case "facebook":
      return raw.includes(".") ? `https://${raw.replace(/^\/+/, "")}` : `https://facebook.com/${handle}`;
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "line":
      // LINE official accounts start with @; a personal ID opens the add-friend page.
      return raw.startsWith("@") ? `https://line.me/R/ti/p/${encodeURIComponent(raw)}` : `https://line.me/ti/p/~${encodeURIComponent(handle)}`;
    case "whatsapp": {
      const digits = raw.replace(/[^\d]/g, "");
      return digits.length >= 7 ? `https://wa.me/${digits}` : null;
    }
  }
}

/** A Google map with no key needed: the embed form of a normal search, and the link to open it in Maps. */
export function mapLinks(query: string) {
  const q = encodeURIComponent(query);
  return { embed: `https://www.google.com/maps?q=${q}&output=embed`, open: `https://www.google.com/maps/search/?api=1&query=${q}` };
}

/** What the fleet mostly is, for words like "Book a scooter": car, scooter, motorbike, or vehicle for a mix. */
export function fleetNoun(kinds: string[]): "car" | "scooter" | "motorbike" | "vehicle" {
  if (!kinds.length) return "vehicle";
  const count = (list: string[]) => kinds.filter((kind) => list.includes(kind)).length;
  const cars = count(["car", "van"]);
  const scooters = count(["scooter", "ebike"]);
  const bikes = count(["motorbike"]);
  if (cars === kinds.length) return "car";
  if (scooters === kinds.length) return "scooter";
  if (bikes === kinds.length) return "motorbike";
  if (scooters + bikes === kinds.length) return scooters >= bikes ? "scooter" : "motorbike";
  return "vehicle";
}

/** The kinds of vehicle on offer, most common first. */
export function kindsOffered(kinds: string[]) {
  const counts = new Map<string, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([kind]) => kind);
}

/** An opening time ("17:30") the way the reader's locale writes it: "5:30 PM" in en-US, "17:30" in en-GB or de. */
export function siteTime(hhmm: string, locale: string) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return hhmm;
  try {
    // 24-hour locales write 07:00, 12-hour ones 7:00 AM.
    const twelve = /h1[12]/.test(new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle || "");
    return new Intl.DateTimeFormat(locale, { hour: twelve ? "numeric" : "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1, hours, minutes)));
  } catch {
    return hhmm;
  }
}

/** "+66 81 234 5678" as a tel: link. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
