import { statSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { allGuideSlugs, allResourceSlugs, getGuide, getResource, GUIDE_CATEGORIES, guideLocales, listGuides, resourceLocales } from "@/lib/site/content";
import { DEFAULT_SITE_LOCALE, hreflangFor } from "@/lib/site/locale-path";
import { listDocs, loadPublishedArticles } from "@/lib/site/docs";
import { listLegalDocs } from "@/lib/site/legal";
import { listSwitchPages } from "@/lib/site/switch";
import { siteUrl } from "@/lib/site/seo";

/**
 * Every page of RoveHQ's website in every language it exists in, each with its hreflang alternates. Pages written
 * for every language (home, pricing, FAQ, contact, the guide and resource lists) are listed in all of them; a guide or
 * resource only in the languages it has been written in. The staff app is never listed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Help articles approved from the team's content queue are in the database, not files: fetched before listing.
  await loadPublishedArticles();
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
  // The help centre: English for now (every language's address shows it, with the English one as canonical).
  add("/docs", ["en"], built, 0.7);
  for (const doc of listDocs("en")) add(`/docs/${doc.slug}`, ["en"], doc.updated || built.toISOString().slice(0, 10), 0.6);
  // Switching from other rental software: the hub in every language, each software's page in English for now.
  add("/switch", supportedLocaleCodes, built, 0.7);
  for (const page of listSwitchPages("en")) add(`/switch/${page.slug}`, ["en"], page.updated || built.toISOString().slice(0, 10), 0.6);
  // Legal pages: English text for every language, so only the English addresses are listed.
  add("/legal", supportedLocaleCodes, built, 0.3);
  for (const doc of listLegalDocs("en")) add(`/legal/${doc.slug}`, ["en"], doc.updated || built.toISOString().slice(0, 10), 0.3);
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
