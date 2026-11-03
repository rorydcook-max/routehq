import { cache } from "react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { supportedLocaleCodes } from "@/lib/i18n/locales";

/**
 * RoveHQ's website pages are drawn ahead of time, one copy per language (app/(site)/site/[locale]). The language
 * comes from the address, never the request: each layout, page and generateMetadata calls siteLocale(params) first,
 * which hands it to next-intl (setRequestLocale) so getLocale()/getTranslations() need no headers or cookies.
 */

const supported = new Set<string>(supportedLocaleCodes);

/** A website page's props when its address has only the language. */
export type SiteParams = { params: Promise<{ locale: string }> };

/** Every language, for generateStaticParams. */
export function siteLocaleParams() {
  return supportedLocaleCodes.map((locale) => ({ locale }));
}

export async function siteLocale(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!supported.has(locale)) notFound();
  setRequestLocale(locale);
  return locale;
}

// The currency the website's pictures show amounts in, for one page being drawn. The page sets it from its address
// (proxy.ts put the visitor's currency there) before its pictures draw; React's cache keeps it to that one render.
const pageMoney = cache(() => ({ currency: "USD" }));

export function setPageCurrency(currency: string) {
  pageMoney().currency = currency;
}

export function pageCurrency() {
  return pageMoney().currency;
}
