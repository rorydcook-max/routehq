export const supportedLocaleCodes = ["en", "th", "id", "ms", "vi", "zh", "ru", "fr", "ja"] as const;

export type SupportedLocale = (typeof supportedLocaleCodes)[number];

export const supportedLocaleOptions: Array<{ code: SupportedLocale; label: string }> = [
  { code: "en", label: "English" },
  { code: "th", label: "Thai" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ms", label: "Bahasa Malaysia" },
  { code: "vi", label: "Vietnamese" },
  { code: "zh", label: "Chinese" },
  { code: "ru", label: "Russian" },
  { code: "fr", label: "French" },
  { code: "ja", label: "Japanese" }
];
