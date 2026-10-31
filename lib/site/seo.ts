import type { Metadata } from "next";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { DEFAULT_SITE_LOCALE, hreflangFor, localizeSitePath } from "@/lib/site/locale-path";

/** The website's canonical origin (NEXT_PUBLIC_SITE_URL, else https://rovehq.io), without a trailing slash. */
export function siteOrigin() {
  return String(process.env.NEXT_PUBLIC_SITE_URL || "https://rovehq.io").replace(/\/$/, "");
}

/** The full address of a website page in a language: ("/pricing", "th") → https://rovehq.io/th/pricing. */
export function siteUrl(path: string, locale: string) {
  return `${siteOrigin()}${localizeSitePath(path, locale)}`;
}

/**
 * hreflang alternates for a website page: every language it exists in, plus x-default (English), and the
 * self-referencing canonical for the language being shown. `available` narrows it for content that is not in every
 * language (a guide only lists the languages it has been translated into).
 */
export function siteAlternates(path: string, locale: string, available: readonly string[] = supportedLocaleCodes): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const code of available) languages[hreflangFor(code)] = siteUrl(path, code);
  if (available.includes(DEFAULT_SITE_LOCALE)) languages["x-default"] = siteUrl(path, DEFAULT_SITE_LOCALE);
  return { canonical: siteUrl(path, locale), languages };
}

/** Open Graph locale: the language, with "_" before a region ("zh-TW" → "zh_TW"). */
export function ogLocale(locale: string) {
  return locale.replace("-", "_");
}

/** Metadata shared by every website page: title, description, canonical + hreflang, Open Graph. */
export function siteMetadata({ path, locale, title, description, available, absoluteTitle, type = "website" }: { path: string; locale: string; title: string; description: string; available?: readonly string[]; absoluteTitle?: boolean; type?: "website" | "article" }): Metadata {
  const alternates = siteAlternates(path, locale, available);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates,
    openGraph: { type, url: alternates.canonical as string, siteName: "RoveHQ", title: absoluteTitle ? title : `${title} | RoveHQ`, description, locale: ogLocale(locale) },
    twitter: { card: "summary_large_image", title, description }
  };
}
