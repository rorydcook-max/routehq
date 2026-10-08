import { customerLocaleCodes, type SupportedLocale } from "@/lib/i18n/locales";

/** Remembers the language a customer picked on a booking link, change-to-sign page or online booking page. */
export const CUSTOMER_LOCALE_COOKIE = "routehq_customer_locale";

const supported = new Set<string>(customerLocaleCodes);

/**
 * The customer's language: what they picked, else the first language their
 * browser asks for that we have, else English.
 *
 * "zh-TW" and "zh-HK" readers get Traditional Chinese; other Chinese gets
 * Simplified. Norwegian "no"/"nn" map to Bokmal, and "tl" to Filipino.
 */
export function pickLocale(chosen: string | null | undefined, acceptLanguage: string | null | undefined): SupportedLocale {
  if (chosen && supported.has(chosen)) return chosen as SupportedLocale;
  const wanted = String(acceptLanguage || "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.trim(), q: q ? Number(q) : 1 };
    })
    .filter((entry) => entry.tag && Number.isFinite(entry.q))
    .sort((a, b) => b.q - a.q);
  for (const { tag } of wanted) {
    const lower = tag.toLowerCase();
    const base = lower.split("-")[0];
    const mapped = base === "no" || base === "nn" ? "nb" : base === "tl" ? "fil" : base === "iw" ? "he" : base === "in" ? "id" : base;
    if (supported.has(mapped)) return mapped as SupportedLocale;
  }
  return "en";
}
