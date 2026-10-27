export const supportedLocaleCodes = [
  "en", "th", "my", "vi", "id", "ms", "zh", "zh-TW", "fil", "hi", "ta", "si",
  "fr", "ru", "es", "pt", "he", "de", "sv", "nb", "lo", "ko", "ja"
] as const;

export type SupportedLocale = (typeof supportedLocaleCodes)[number];

/**
 * Labels are written in each language's own script first, so someone who reads
 * only that language can find it in the list; the English name follows for
 * owners and admins reading the same list.
 *
 * Notes on choices:
 *   zh     Simplified Chinese (mainland China)
 *   zh-TW  Traditional Chinese, as read in Taiwan. Spoken Taiwanese (Hokkien)
 *          is rarely written in software, so this is what "Taiwanese" means here.
 *   si/ta  Sri Lanka's two official languages. Sinhala is the majority
 *          language; Tamil also covers Tamil speakers from southern India.
 *   fil    Filipino, the standardised form of Tagalog.
 *   nb     Norwegian Bokmal, the written standard most Norwegians use.
 *   pt     Brazilian Portuguese (Brazil's rental market); readers in Portugal and Africa understand it.
 *
 * Order (Rory, 27 Oct 2026): alphabetical by each language's own name, the way language lists are
 * usually sorted: Latin-script names A–Z first, then the other scripts (Cyrillic, Hebrew, the Indian
 * scripts, Thai, Lao, Burmese, Korean, Japanese, Chinese). Written out rather than sorted at run time so
 * the server and every browser show the same order. Every language picker reads this list.
 */
export const supportedLocaleOptions: Array<{ code: SupportedLocale; label: string; english: string }> = [
  { code: "id", label: "Bahasa Indonesia (Indonesian)", english: "Indonesian" },
  { code: "ms", label: "Bahasa Melayu (Malay)", english: "Malay" },
  { code: "de", label: "Deutsch (German)", english: "German" },
  { code: "en", label: "English", english: "English" },
  { code: "es", label: "Español (Spanish)", english: "Spanish" },
  { code: "fr", label: "Français (French)", english: "French" },
  { code: "nb", label: "Norsk (Norwegian)", english: "Norwegian (Bokmal)" },
  { code: "pt", label: "Português (Portuguese)", english: "Portuguese (Brazil)" },
  { code: "sv", label: "Svenska (Swedish)", english: "Swedish" },
  { code: "fil", label: "Tagalog (Filipino)", english: "Filipino (Tagalog)" },
  { code: "vi", label: "Tiếng Việt (Vietnamese)", english: "Vietnamese" },
  { code: "ru", label: "Русский (Russian)", english: "Russian" },
  { code: "he", label: "עברית (Hebrew)", english: "Hebrew" },
  { code: "hi", label: "हिन्दी (Hindi)", english: "Hindi" },
  { code: "ta", label: "தமிழ் (Tamil)", english: "Tamil" },
  { code: "si", label: "සිංහල (Sinhala)", english: "Sinhala" },
  { code: "th", label: "ไทย (Thai)", english: "Thai" },
  { code: "lo", label: "ລາວ (Lao)", english: "Lao" },
  { code: "my", label: "မြန်မာ (Burmese)", english: "Burmese" },
  { code: "ko", label: "한국어 (Korean)", english: "Korean" },
  { code: "ja", label: "日本語 (Japanese)", english: "Japanese" },
  { code: "zh", label: "简体中文 (Chinese, Simplified)", english: "Chinese (Simplified)" },
  { code: "zh-TW", label: "繁體中文 (Chinese, Traditional - Taiwan)", english: "Chinese (Traditional, Taiwan)" }
];

/**
 * Languages the customer pages (booking link, online booking, booking page, directory) are offered in: every
 * supported language, now that each has a full translation (25 Oct 2026). Machine-assisted; native read-throughs
 * are on the launch checklist.
 */
export const customerLocaleCodes: readonly SupportedLocale[] = supportedLocaleCodes;
export const customerLocaleOptions = supportedLocaleOptions;

/** Languages the operator's own app is offered in: the same full list. */
export const operatorLocaleCodes: readonly SupportedLocale[] = supportedLocaleCodes;
export const operatorLocaleOptions = supportedLocaleOptions;

/** Languages written right to left. The page direction follows the reader's language. */
export const rightToLeftLocales = new Set<string>(["he"]);

export function textDirection(locale: string | null | undefined): "rtl" | "ltr" {
  return locale && rightToLeftLocales.has(locale) ? "rtl" : "ltr";
}
