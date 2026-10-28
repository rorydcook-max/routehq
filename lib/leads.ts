/** The website's free-resource form (/resources/<slug>): shared by the form, its server action and the admin console. */

export { CONTACT_FLEETS as LEAD_FLEETS, CONTACT_FLEET_LABEL as LEAD_FLEET_LABEL } from "@/lib/contact";

/**
 * Countries offered in the form (ISO 3166 codes, named in the visitor's language with Intl.DisplayNames): South-East
 * and South Asia first in mind, then where rental owners and their customers often come from. "other" covers the rest.
 */
export const LEAD_COUNTRIES = [
  "TH", "VN", "ID", "MY", "PH", "KH", "LA", "MM", "SG", "BN", "TL", "LK", "IN", "NP", "BD", "MV",
  "CN", "TW", "HK", "JP", "KR", "AE", "IL", "TR", "AU", "NZ", "US", "CA", "MX", "BR", "GB", "IE",
  "DE", "FR", "ES", "PT", "IT", "NL", "SE", "NO", "DK", "FI", "CH", "AT", "PL", "RU", "ZA", "KE"
] as const;

/** open: shown in a new tab instead of saved (the contract builder's print page). */
export type LeadDownload = { href: string; label: string; detail: string; primary: boolean; open?: boolean };

export type LeadValues = { email: string; name: string; business: string; country: string; fleet: string; consent: boolean };

export type LeadState = {
  /** Counts submissions, so the fields are drawn again with what was typed after a failed send. */
  n: number;
  status?: "sent" | "error";
  error?: "required" | "email" | "tooMany" | "failed";
  values?: LeadValues;
  downloads?: LeadDownload[];
  emailed?: boolean;
};

/** Country names in a language, sorted for that language; codes alone where the runtime has no names. */
export function leadCountryOptions(locale: string): Array<{ code: string; name: string }> {
  let name = (code: string) => code;
  try {
    const names = new Intl.DisplayNames([locale, "en"], { type: "region" });
    name = (code: string) => names.of(code) || code;
  } catch {
    // Codes alone.
  }
  return LEAD_COUNTRIES.map((code) => ({ code, name: name(code) })).sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** Readable file size: 48 KB, 1.2 MB. */
export function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
