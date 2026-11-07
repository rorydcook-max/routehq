import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ROVE_LOCALES } from "@/lib/rove/paths";

/**
 * rove.rent's pages are drawn per language from the address (app/(rove)/rove/[locale]), never from the request, so
 * they can be cached like the RoveHQ website's: each layout, page and generateMetadata calls roveLocale(params) first.
 */
export type RoveParams = { params: Promise<{ locale: string }> };

export function roveLocaleParams() {
  return ROVE_LOCALES.map((locale) => ({ locale }));
}

export async function roveLocale(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!ROVE_LOCALES.includes(locale)) notFound();
  setRequestLocale(locale);
  return locale;
}

/** Amounts in the business's currency, written the renter's way ("฿11,000"). */
export function roveMoney(value: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(Math.round(value));
  } catch {
    return `${currency} ${Math.round(value).toLocaleString("en-US")}`;
  }
}

/** A date for people ("12 Nov 2026"), in the page's language. */
export function roveDate(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
  } catch {
    return iso.slice(0, 10);
  }
}
