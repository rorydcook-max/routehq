import { headers } from "next/headers";

/**
 * Renters see prices in the business's currency and, beside them, roughly what that is in their own (Rory, 2 Nov 2026).
 * The business only ever sees its own currency. What is charged never changes: the conversion is a guide.
 */

/** The currencies a renter can pick, in the order of the list (alphabetical by code). */
export const VISITOR_CURRENCIES = [
  "AED", "AUD", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR", "GBP", "HKD", "IDR", "ILS", "INR", "JPY", "KRW", "KZT",
  "MYR", "NOK", "NZD", "PHP", "PLN", "RUB", "SAR", "SEK", "SGD", "THB", "TWD", "UAH", "USD", "VND", "ZAR"
] as const;

const EURO = ["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"];
const BY_COUNTRY: Record<string, string> = {
  AE: "AED", AU: "AUD", BR: "BRL", CA: "CAD", CH: "CHF", CN: "CNY", CZ: "CZK", DK: "DKK", GB: "GBP", HK: "HKD", ID: "IDR", IL: "ILS",
  IN: "INR", JP: "JPY", KR: "KRW", KZ: "KZT", MY: "MYR", NO: "NOK", NZ: "NZD", PH: "PHP", PL: "PLN", RU: "RUB", SA: "SAR", SE: "SEK",
  SG: "SGD", TH: "THB", TW: "TWD", UA: "UAH", US: "USD", VN: "VND", ZA: "ZAR",
  ...Object.fromEntries(EURO.map((country) => [country, "EUR"]))
};

/** Without a country (or one not listed), the language is the next best guess. */
const BY_LANGUAGE: Record<string, string> = {
  de: "EUR", fr: "EUR", es: "EUR", it: "EUR", nl: "EUR", el: "EUR", hr: "EUR", pl: "PLN", fi: "EUR", pt: "EUR", sv: "SEK", nb: "NOK", da: "DKK", ru: "RUB", uk: "UAH",
  he: "ILS", hi: "INR", ja: "JPY", ko: "KRW", zh: "CNY", "zh-TW": "TWD", id: "IDR", ms: "MYR", vi: "VND", fil: "PHP", th: "THB"
};

/** The renter's likely currency, from where they are browsing (Vercel says the country) or else their language. */
export async function visitorCurrency(locale?: string): Promise<string | null> {
  const list = await headers();
  const country = (list.get("x-vercel-ip-country") || "").toUpperCase();
  if (BY_COUNTRY[country]) return BY_COUNTRY[country];
  if (locale && BY_LANGUAGE[locale]) return BY_LANGUAGE[locale];
  const first = (list.get("accept-language") || "").split(",")[0]?.trim();
  const region = first?.split("-")[1]?.toUpperCase();
  if (region && BY_COUNTRY[region]) return BY_COUNTRY[region];
  return null;
}

/**
 * How much one unit of the business's currency is in each of the listed currencies, refreshed twice a day.
 * Empty when the rates can't be fetched: the page then just shows the business's prices.
 */
export async function ratesFrom(base: string): Promise<Record<string, number>> {
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, { next: { revalidate: 43200 } });
    if (!response.ok) return {};
    const data = await response.json();
    if (data?.result !== "success" || !data.rates) return {};
    const rates: Record<string, number> = {};
    for (const code of VISITOR_CURRENCIES) {
      const rate = Number(data.rates[code]);
      if (code !== base && Number.isFinite(rate) && rate > 0) rates[code] = rate;
    }
    return rates;
  } catch {
    return {};
  }
}
