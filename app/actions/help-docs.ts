"use server";

import { getLocale } from "next-intl/server";
import { docForAppPath, getDoc, loadPublishedArticles } from "@/lib/site/docs";

/** The help article for the screen someone is on (the "?" in the app), or null for the help centre's front page. */
export async function helpForScreen(pathname: string): Promise<string | null> {
  // A published-from-the-queue article can be about a screen too.
  await loadPublishedArticles();
  const doc = docForAppPath(String(pathname || "/").slice(0, 200));
  return doc ? `/docs/${doc.slug}` : null;
}

/**
 * The article itself, for the help panel that opens inside the app (Rory, 7 Nov 2026: the "?" took people out of the
 * app without warning). `pathname` may carry the query that picks a tab ("/settings?tab=team"). In the reader's
 * language where the article has been translated, else English. Null when no article is about this screen.
 */
export async function helpArticleForScreen(pathname: string): Promise<{ slug: string; title: string; description: string; html: string; href: string } | null> {
  await loadPublishedArticles();
  const meta = docForAppPath(String(pathname || "/").slice(0, 300));
  if (!meta) return null;
  const locale = await getLocale().catch(() => "en");
  const doc = getDoc(locale, meta.slug);
  if (!doc) return null;
  return { slug: doc.slug, title: doc.title, description: doc.description, html: doc.html, href: `/docs/${doc.slug}` };
}
