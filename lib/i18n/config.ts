export const operatorLocales = ["en", "th", "id", "ms", "vi", "zh", "ru", "fr", "ja"] as const;
export const customerLocales = ["en", "th", "ru", "zh", "fr", "ja"] as const;
export const supportedCurrencies = ["THB", "IDR", "MYR", "VND", "USD"] as const;

export type OperatorLocale = (typeof operatorLocales)[number];
export type CustomerLocale = (typeof customerLocales)[number];
export type SupportedCurrency = (typeof supportedCurrencies)[number];

export const defaultLocale: OperatorLocale = "en";
export const defaultTimeZone = "Asia/Bangkok";

export function isOperatorLocale(locale: string): locale is OperatorLocale {
  return operatorLocales.includes(locale as OperatorLocale);
}

export function resolveLocale(preferredLocale?: string | null, organizationDefault = defaultLocale) {
  if (preferredLocale && isOperatorLocale(preferredLocale)) {
    return preferredLocale;
  }

  return isOperatorLocale(organizationDefault) ? organizationDefault : defaultLocale;
}

export function formatLocalizedMoney(value: number, currency: SupportedCurrency, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}
