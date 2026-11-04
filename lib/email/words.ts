import { supportedLocaleCodes } from "@/lib/i18n/locales";

/**
 * The few words the email design adds around each email's own text (buttons, "If the button doesn't work...",
 * the "why you got this" footer, "Sent with RoveHQ"), in a given language.
 *
 * Emails go out from cron jobs and server actions where no page is being shown, so the language is passed in
 * (the customer's, the visitor's, or the operator's) rather than read from the request. The words live in the
 * "email" namespace of locales/<lang>/common.json (English source in locales/en/common.json); anything missing in a
 * language falls back to English. The menu names in the footer match how the app itself names Settings and
 * Notifications in that language.
 */

export type EmailWordKey =
  | "openInApp"
  | "openApp"
  | "choosePassword"
  | "linkFallback"
  | "yourBusiness"
  | "alertReason"
  | "alertSettings"
  | "summaryReason"
  | "summarySettings"
  | "passwordReason"
  | "emailChangedReason"
  | "sentWith";

export type EmailWords = {
  /** The language the words are in (a supported code; "en" when the wanted one isn't supported). */
  locale: string;
  /** One label, with {placeholders} filled in. */
  t: (key: EmailWordKey, values?: Record<string, string>) => string;
};

const supported = new Set<string>(supportedLocaleCodes);

/** "th-TH" -> "th", "zh-Hant-TW"/"zh-TW" -> "zh-TW", anything unknown -> "en". */
export function emailLocale(wanted: string | null | undefined): string {
  const code = String(wanted || "").trim().replace(/_/g, "-");
  if (!code) return "en";
  if (supported.has(code)) return code;
  const lower = code.toLowerCase();
  if (lower.startsWith("zh")) return /tw|hant|hk|mo/.test(lower) ? "zh-TW" : "zh";
  const base = lower.split("-")[0];
  if (base === "tl") return "fil";
  if (base === "no" || base === "nn") return "nb";
  return supported.has(base) ? base : "en";
}

/** Builds the words from already-loaded "email" namespaces (scripts can read the JSON files themselves). */
export function emailWordsFrom(locale: string, english: Record<string, string>, own: Record<string, string> | null | undefined): EmailWords {
  const words: Record<string, string> = { ...english, ...(own || {}) };
  return {
    locale,
    t: (key, values = {}) => String(words[key] ?? english[key] ?? key).replace(/\{(\w+)\}/g, (match, name) => (name in values ? values[name] : match))
  };
}

const cache = new Map<string, Promise<EmailWords>>();

async function namespace(locale: string): Promise<Record<string, string>> {
  try {
    const messages = (await import(`../../locales/${locale}/common.json`)).default as Record<string, any>;
    return (messages.email || {}) as Record<string, string>;
  } catch {
    return {};
  }
}

/** The email words in the reader's language (English when it isn't one of ours). */
export function emailWords(wanted: string | null | undefined): Promise<EmailWords> {
  const locale = emailLocale(wanted);
  let pending = cache.get(locale);
  if (!pending) {
    pending = Promise.all([namespace("en"), locale === "en" ? Promise.resolve(null) : namespace(locale)]).then(([english, own]) => emailWordsFrom(locale, english, own));
    cache.set(locale, pending);
  }
  return pending;
}
