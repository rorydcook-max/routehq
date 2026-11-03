"use server";

import { docForAppPath, loadPublishedArticles } from "@/lib/site/docs";

/** The help article for the screen someone is on (the "?" in the app), or null for the help centre's front page. */
export async function helpForScreen(pathname: string): Promise<string | null> {
  // A published-from-the-queue article can be about a screen too.
  await loadPublishedArticles();
  const doc = docForAppPath(String(pathname || "/").slice(0, 200));
  return doc ? `/docs/${doc.slug}` : null;
}
