import { supportedLocaleCodes } from "@/lib/i18n/locales";

/**
 * Whether a language's own file has a text, not just the English fallback i18n/request.ts merges in. For a new
 * headline or page title that replaces an older, already translated one: until the new text is translated, a
 * language keeps showing its translated old text instead of English. Loaded the same way i18n/request.ts loads the
 * files (bundled), so it works wherever the page is drawn.
 */
const files = new Map<string, Promise<Record<string, unknown> | null>>();

function messagesOf(locale: string) {
  if (!files.has(locale)) {
    files.set(
      locale,
      import(`../../locales/${locale}/common.json`).then(
        (module) => (module.default ?? module) as Record<string, unknown>,
        () => null
      )
    );
  }
  return files.get(locale)!;
}

/** await hasOwnTranslation("th", "marketing.heroH1") */
export async function hasOwnTranslation(locale: string, key: string) {
  if (locale === "en") return true;
  let node: unknown = await messagesOf(locale);
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object") return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" && node.trim().length > 0;
}

/** The languages whose own file has this text (English always): the ones a page written English-first is listed in. */
export async function translatedLocales(key: string): Promise<string[]> {
  const has = await Promise.all(supportedLocaleCodes.map((locale) => hasOwnTranslation(locale, key)));
  return supportedLocaleCodes.filter((_, index) => has[index]);
}
