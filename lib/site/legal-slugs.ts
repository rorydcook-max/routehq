/**
 * The website's legal pages (/legal/<slug>), content in content/legal/en/<slug>.md (lib/site/legal.ts).
 * Safe to import from the proxy and the browser (no server-only imports).
 */
export const LEGAL_SLUGS = ["privacy", "terms", "dpa", "subprocessors", "cookies"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/** Where the legal pages live, for links from the app and booking pages (which are on other domains). */
export function legalUrl(slug: LegalSlug | "" = "") {
  const origin = String(process.env.NEXT_PUBLIC_SITE_URL || "https://rovehq.io").replace(/\/$/, "");
  return `${origin}/legal${slug ? `/${slug}` : ""}`;
}
