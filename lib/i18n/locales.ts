export const supportedLocaleCodes = [
  "en", "th", "my", "vi", "id", "ms", "zh", "zh-TW", "fil", "hi", "ta", "si",
  "fr", "ru", "es", "he", "de", "sv", "nb", "lo", "ko", "ja"
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
 */
export const supportedLocaleOptions: Array<{ code: SupportedLocale; label: string; english: string }> = [
  { code: "en", label: "English", english: "English" },
  { code: "th", label: "ไทย (Thai)", english: "Thai" },
  { code: "my", label: "မြန်မာ (Burmese)", english: "Burmese" },
  { code: "vi", label: "Tiếng Việt (Vietnamese)", english: "Vietnamese" },
  { code: "id", label: "Bahasa Indonesia (Indonesian)", english: "Indonesian" },
  { code: "ms", label: "Bahasa Melayu (Malay)", english: "Malay" },
  { code: "zh", label: "简体中文 (Chinese, Simplified)", english: "Chinese (Simplified)" },
  { code: "zh-TW", label: "繁體中文 (Chinese, Traditional - Taiwan)", english: "Chinese (Traditional, Taiwan)" },
  { code: "fil", label: "Tagalog (Filipino)", english: "Filipino (Tagalog)" },
  { code: "hi", label: "हिन्दी (Hindi)", english: "Hindi" },
  { code: "ta", label: "தமிழ் (Tamil)", english: "Tamil" },
  { code: "si", label: "සිංහල (Sinhala)", english: "Sinhala" },
  { code: "fr", label: "Français (French)", english: "French" },
  { code: "ru", label: "Русский (Russian)", english: "Russian" },
  { code: "es", label: "Español (Spanish)", english: "Spanish" },
  { code: "he", label: "עברית (Hebrew)", english: "Hebrew" },
  { code: "de", label: "Deutsch (German)", english: "German" },
  { code: "sv", label: "Svenska (Swedish)", english: "Swedish" },
  { code: "nb", label: "Norsk (Norwegian)", english: "Norwegian (Bokmal)" },
  { code: "lo", label: "ລາວ (Lao)", english: "Lao" },
  { code: "ko", label: "한국어 (Korean)", english: "Korean" },
  { code: "ja", label: "日本語 (Japanese)", english: "Japanese" }
];

/** Languages written right to left. The page direction follows the reader's language. */
export const rightToLeftLocales = new Set<string>(["he"]);

export function textDirection(locale: string | null | undefined): "rtl" | "ltr" {
  return locale && rightToLeftLocales.has(locale) ? "rtl" : "ltr";
}
