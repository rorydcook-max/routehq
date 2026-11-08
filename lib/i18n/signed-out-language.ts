import { operatorLocaleOptions } from "@/lib/i18n/locales";
import { STAFF_LOCALE_COOKIE } from "@/lib/i18n/staff-locale";
import { isSitePath, localizeSitePath, splitSiteLocale } from "@/lib/site/locale-path";

/**
 * Keeps a signed-out language choice on this device and redraws the page in it (the sign-in pages' picker and the
 * website's). On RoveHQ's website each language has its own address, so there it opens that language's address
 * (/th/pricing); the cookie still carries the choice to sign-in and the app. Browser only.
 * Apart from components/auth-language.tsx (task perf2, 8 Nov 2026) so the website's pickers don't bring next-intl's
 * browser code with them.
 */
export function chooseSignedOutLanguage(code: string) {
  document.cookie = `${STAFF_LOCALE_COOKIE}=${code}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  const { locale, rest } = splitSiteLocale(window.location.pathname);
  if (locale || isSitePath(rest)) {
    // No #hash: after "Features" (#how) every language change used to land back on that section.
    window.location.assign(`${localizeSitePath(rest, code)}${window.location.search}`);
    return;
  }
  window.location.reload();
}

/** The languages offered, by their own names without the "(…)" note. */
export const signedOutLanguages = operatorLocaleOptions.map((option) => ({ code: option.code, label: option.label.replace(/ \(.*\)$/, "") }));
