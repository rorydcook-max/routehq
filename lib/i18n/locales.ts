export const supportedLocaleCodes = ["en", "th", "my", "vi", "id", "ms", "zh", "ru", "fr", "ja"] as const;

export type SupportedLocale = (typeof supportedLocaleCodes)[number];

/**
 * Labels are written in each language's own script first, so someone who reads
 * only that language can find it in the list; the English name follows for
 * owners and admins reading the same list.
 */
export const supportedLocaleOptions: Array<{ code: SupportedLocale; label: string }> = [
  { code: "en", label: "English" },
  { code: "th", label: "ไทย (Thai)" },
  { code: "my", label: "မြန်မာ (Burmese)" },
  { code: "vi", label: "Tiếng Việt (Vietnamese)" },
  { code: "id", label: "Bahasa Indonesia (Indonesian)" },
  { code: "ms", label: "Bahasa Melayu (Malay)" },
  { code: "zh", label: "中文 (Chinese)" },
  { code: "ru", label: "Русский (Russian)" },
  { code: "fr", label: "Français (French)" },
  { code: "ja", label: "日本語 (Japanese)" }
];
