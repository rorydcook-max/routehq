import { pickLocale } from "@/lib/i18n/customer-locale";
import type { SupportedLocale } from "@/lib/i18n/locales";

/** Remembers the language someone picked on the sign-in pages, before they have an account to keep it in. */
export const STAFF_LOCALE_COOKIE = "routehq_locale";

/** Languages the staff app is fully written in. Others still fall back to English, so they are not offered before sign-in. */
export const LAUNCH_LOCALES = [
  { code: "en", label: "English" },
  { code: "th", label: "ไทย" }
] as const;

const launchCodes = new Set<string>(LAUNCH_LOCALES.map((locale) => locale.code));

/** The language for someone who is not signed in: what they picked, else their phone's language if we have it, else English. */
export function signedOutLocale(chosen: string | null | undefined, acceptLanguage: string | null | undefined): SupportedLocale {
  const picked = pickLocale(chosen, acceptLanguage);
  return (launchCodes.has(picked) ? picked : "en") as SupportedLocale;
}
