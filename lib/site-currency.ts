/**
 * The currency the public website shows money in: the visitor's own, US dollars when we can't tell
 * (Rory, 27 Oct 2026). Country from Vercel's x-vercel-ip-country header; where there is no such header (a local
 * server), SITE_DEFAULT_COUNTRY. Never the browser's language. Only currencies lib/plan-currency.ts has a rate for.
 */

import { headers } from "next/headers";
import { localPrice, planCurrency } from "@/lib/plan-currency";

const EURO = ["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK", "ME", "XK", "AD", "MC", "SM", "VA"];

const BY_COUNTRY: Record<string, string> = {
  ...Object.fromEntries(EURO.map((country) => [country, "EUR"])),
  TH: "THB", US: "USD", GB: "GBP", AU: "AUD", NZ: "NZD", CA: "CAD", SG: "SGD", MY: "MYR", ID: "IDR", PH: "PHP",
  VN: "VND", LA: "LAK", MM: "MMK", KH: "KHR", IN: "INR", LK: "LKR", CN: "CNY", TW: "TWD", HK: "HKD", JP: "JPY",
  KR: "KRW", BR: "BRL", MX: "MXN", CO: "COP", SE: "SEK", NO: "NOK", IL: "ILS", AE: "AED", ZA: "ZAR"
};

/** A currency for a two-letter country code, or null when plan-currency can't price in it. */
export function currencyForCountry(country: string | null | undefined): string | null {
  const code = BY_COUNTRY[String(country || "").trim().toUpperCase()];
  return code && planCurrency(code) === code ? code : null;
}

/** Whether plan-currency has a rate for this code. */
export function isSiteCurrency(code: string | null | undefined) {
  const upper = String(code || "").toUpperCase();
  return Boolean(upper) && planCurrency(upper) === upper;
}

/**
 * The visitor's currency, from where they are, never from their language: someone in Thailand with a phone set to
 * English (UK) pays in baht, not pounds (Rory, 27 Oct 2026). (1) Vercel's x-vercel-ip-country header; (2) the
 * SITE_DEFAULT_COUNTRY env var, for servers without that header (the local build sets TH); (3) US dollars.
 * The pricing page's currency picker stays as the manual override.
 */
export async function visitorCurrency(): Promise<string> {
  const list = await headers();
  return currencyForCountry(list.get("x-vercel-ip-country")) || currencyForCountry(process.env.SITE_DEFAULT_COUNTRY) || "USD";
}

/**
 * A made-up amount for the website's pictures, set in THB and shown as a plausible round number in the currency:
 * two significant figures, then to the nearest 5 of the last one when the amount is 20 or more of that step
 * (฿5,600 → $170, ฿3,000 → $90, ฿250 → $7.50, Rp3,000,000). THB stays as set.
 */
export function sampleAmount(thb: number, currency: string): number {
  const code = planCurrency(currency);
  if (code === "THB" || thb <= 0) return thb;
  // plan-currency's conversion (two significant figures), then tidied to a 5 in the last figure.
  const value = localPrice(thb, code);
  let step = 10 ** (Math.floor(Math.log10(value)) - 1);
  if (value / step >= 20) step *= 5;
  return Number((Math.round(value / step) * step).toFixed(2));
}
