import { statSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { allGuideSlugs, allResourceSlugs, getGuide, getResource, GUIDE_CATEGORIES, guideLocales, listGuides, resourceLocales } from "@/lib/site/content";
import { DEFAULT_SITE_LOCALE, hreflangFor } from "@/lib/site/locale-path";
import { siteUrl } from "@/lib/site/seo";

/**
 * Every page of Lokalfleet's website in every language it exists in, each with its hreflang alternates. Pages written
 * for every language (home, pricing, FAQ, contact, the guide and resource lists) are listed in all of them; a guide or
 * resource only in the languages it has been written in. The staff app is never listed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const add = (path: string, locales: readonly string[], lastModified: Date | string, priority: number) => {
    const languages: Record<string, string> = {};
    for (const code of locales) languages[hreflangFor(code)] = siteUrl(path, code);
    if (locales.includes(DEFAULT_SITE_LOCALE)) languages["x-default"] = siteUrl(path, DEFAULT_SITE_LOCALE);
    for (const locale of locales) entries.push({ url: siteUrl(path, locale), lastModified, priority, alternates: { languages } });
  };

  // The site's own pages change with a release: their last change is the build's.
  const built = new Date();
  add("/", supportedLocaleCodes, built, 1);
  add("/pricing", supportedLocaleCodes, built, 0.9);
  add("/guides", supportedLocaleCodes, built, 0.8);
  add("/resources", supportedLocaleCodes, built, 0.8);
  add("/faq", supportedLocaleCodes, built, 0.6);
  add("/contact", supportedLocaleCodes, built, 0.5);
  // A topic page in each language that has a guide on it (or, falling back, any English guide on it).
  for (const category of GUIDE_CATEGORIES) {
    if (listGuides(DEFAULT_SITE_LOCALE).some((guide) => guide.category === category) || supportedLocaleCodes.some((locale) => listGuides(locale).some((guide) => guide.category === category))) {
      add(`/guides/category/${category}`, supportedLocaleCodes, built, 0.5);
    }
  }

  for (const slug of allGuideSlugs()) {
    const locales = guideLocales(slug);
    const updated = locales.map((locale) => getGuide(locale, slug)?.updated || "").sort().pop() || built.toISOString().slice(0, 10);
    add(`/guides/${slug}`, locales, updated, 0.7);
  }
  for (const slug of allResourceSlugs()) {
    const locales = resourceLocales(slug);
    let lastModified: Date | string = built;
    try {
      lastModified = statSync(join(process.cwd(), "content", "resources", locales[0], `${slug}.md`)).mtime;
    } catch {
      // Keep the build date.
    }
    if (getResource(locales[0], slug)?.date) lastModified = getResource(locales[0], slug)!.date;
    add(`/resources/${slug}`, locales, lastModified, 0.7);
  }
  return entries;
}
