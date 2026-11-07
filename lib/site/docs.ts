import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readFileSync, statSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { renderMarkdown, type FaqItem, type Heading } from "@/lib/site/content";

/**
 * The help centre (Rory, 2 Nov 2026): how to use every part of RoveHQ, public on the website at /docs so search
 * engines find it, and opened from inside the app (the Help page and the "?" on each screen).
 * content/docs/<locale>/<slug>.md, Markdown with YAML frontmatter. English is written first; a language without an
 * article shows the English one (its canonical is the English address, so search engines see one page).
 */

const DOCS = join(process.cwd(), "content", "docs");
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DOCS_LOCALE = "en";

/** The sections of the help centre, in the order shown. */
export const DOC_CATEGORIES = ["getting-started", "bookings", "money", "vehicles", "daily-work", "tools", "account"] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

/** The website message key (marketing namespace) for each section's name. */
export const DOC_CATEGORY_KEY: Record<DocCategory, string> = {
  "getting-started": "docsCatStart",
  bookings: "docsCatBookings",
  money: "docsCatMoney",
  vehicles: "docsCatVehicles",
  "daily-work": "docsCatDaily",
  tools: "docsCatTools",
  account: "docsCatAccount"
};

export type DocMeta = {
  slug: string;
  locale: string;
  title: string;
  description: string;
  category: DocCategory;
  order: number;
  /** The app screen it is about ("/fleet/new", "/fleet/[id]"): the "?" there opens it. */
  appPath: string;
  related: string[];
  updated: string;
  /** A screen recording: a full https address, or a name in the help-videos store. */
  video: string | null;
  /** Its poster frame, the same way. */
  poster: string | null;
  faq: FaqItem[];
  readingMinutes: number;
};
export type Doc = DocMeta & { html: string; headings: Heading[] };

const cache = new Map<string, { mtime: number; value: Doc | null }>();
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

function isoDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = str(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

/** Where the help videos are kept: Supabase storage's public "help-videos" bucket. */
export function helpVideoUrl(name: string | null) {
  if (!name) return null;
  if (/^https:\/\//.test(name)) return name;
  const base = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  return base && /^[a-z0-9-]+\.(mp4|webm|jpg|png|webp)$/.test(name) ? `${base}/storage/v1/object/public/help-videos/${name}` : null;
}

function read(locale: string, slug: string): Doc | null {
  if (!SLUG.test(slug) || !/^[A-Za-z-]{2,5}$/.test(locale)) return null;
  const path = join(DOCS, locale, `${slug}.md`);
  let mtime: number;
  try {
    mtime = statSync(path).mtimeMs;
  } catch {
    return null;
  }
  const hit = cache.get(path);
  if (hit && hit.mtime === mtime) return hit.value;
  const raw = readFileSync(path, "utf8").replace(/^﻿/, "");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const data = (match ? parseYaml(match[1]) : {}) as Record<string, any>;
  const body = match ? match[2] : raw;
  const { html, headings } = renderMarkdown(body, locale);
  const category = (DOC_CATEGORIES as readonly string[]).includes(str(data?.category)) ? (str(data.category) as DocCategory) : "getting-started";
  const words = body.split(/\s+/).filter(Boolean).length;
  const value: Doc | null =
    data?.draft === true
      ? null
      : {
          slug,
          locale,
          title: str(data?.title) || slug,
          description: str(data?.description),
          category,
          order: Number.isFinite(Number(data?.order)) ? Number(data.order) : 99,
          appPath: str(data?.appPath),
          related: Array.isArray(data?.related) ? data.related.map(str).filter((item: string) => SLUG.test(item) && item !== slug) : [],
          updated: isoDate(data?.updated),
          video: helpVideoUrl(str(data?.video) || null),
          poster: helpVideoUrl(str(data?.poster) || null),
          faq: Array.isArray(data?.faq)
            ? data.faq.map((item: any) => ({ q: str(item?.q), a: str(item?.a) })).filter((item: FaqItem) => item.q && item.a)
            : [],
          readingMinutes: Math.max(1, Math.round(words / 220)),
          html,
          headings
        };
  cache.set(path, { mtime, value });
  return value;
}

/**
 * Articles published from the team's content queue (/help/team/content), kept in the help_articles table rather than
 * as files so approving one doesn't need a deploy. Two kinds of row:
 * - a whole article: a slug with no file, a title in its frontmatter and a body. Shown like any file article.
 * - extra questions for an existing article: frontmatter {} and body '' with questions in extra_faq. These are merged
 *   into that article's "Common questions" (a whole article's own extra_faq is merged the same way).
 * Everything below stays synchronous for its many callers: the rows are held here, and pages that show articles call
 * loadPublishedArticles() first to refresh them (at most once a minute per server, or straight away after a publish).
 */
type Published = { articles: Map<string, Doc>; markdown: Map<string, string>; extraFaq: Map<string, FaqItem[]> };
let published: Published = { articles: new Map(), markdown: new Map(), extraFaq: new Map() };
let publishedAt = 0;
let publishedVersionNumber = 0;
const PUBLISHED_TTL_MS = 60_000;

/** Goes up whenever the published rows change, so anything that caches articles (the support assistant) knows to rebuild. */
export function publishedVersion() {
  return publishedVersionNumber;
}

function fileExists(slug: string) {
  return SLUG.test(slug) && existsSync(join(DOCS, DOCS_LOCALE, `${slug}.md`));
}

function publishedDoc(row: any): { doc: Doc; markdown: string } | null {
  const slug = str(row?.slug);
  const data = (row?.frontmatter && typeof row.frontmatter === "object" ? row.frontmatter : {}) as Record<string, any>;
  const body = String(row?.body || "");
  // A questions-only row, or a row for a slug that is (now) a file: the file wins, only its questions are used.
  if (!SLUG.test(slug) || !str(data.title) || !body.trim() || fileExists(slug)) return null;
  const { html, headings } = renderMarkdown(body, DOCS_LOCALE);
  const category = (DOC_CATEGORIES as readonly string[]).includes(str(data.category)) ? (str(data.category) as DocCategory) : "getting-started";
  return {
    markdown: body.trim(),
    doc: {
      slug,
      locale: DOCS_LOCALE,
      title: str(data.title),
      description: str(data.description),
      category,
      order: Number.isFinite(Number(data.order)) ? Number(data.order) : 99,
      appPath: str(data.appPath),
      related: Array.isArray(data.related) ? data.related.map(str).filter((item: string) => SLUG.test(item) && item !== slug) : [],
      updated: isoDate(data.updated) || isoDate(row?.published_at),
      video: helpVideoUrl(str(data.video) || null),
      poster: helpVideoUrl(str(data.poster) || null),
      faq: Array.isArray(data.faq) ? data.faq.map((item: any) => ({ q: str(item?.q), a: str(item?.a) })).filter((item: FaqItem) => item.q && item.a) : [],
      readingMinutes: Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 220)),
      html,
      headings
    }
  };
}

/**
 * Refreshes the published articles from the database. Never throws: without a database (a build, a missing key) the
 * help centre is simply the files, as before. `force` skips the one-minute wait (used right after a publish).
 */
export async function loadPublishedArticles(force = false): Promise<void> {
  if (!force && Date.now() - publishedAt < PUBLISHED_TTL_MS) return;
  publishedAt = Date.now();
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const { data, error } = await (createSupabaseAdminClient() as any)
      .from("help_articles")
      .select("slug, frontmatter, body, extra_faq, published_at")
      .not("published_at", "is", null)
      .limit(1000);
    if (error) throw error;
    const next: Published = { articles: new Map(), markdown: new Map(), extraFaq: new Map() };
    for (const row of (data || []) as any[]) {
      const built = publishedDoc(row);
      if (built) {
        next.articles.set(built.doc.slug, built.doc);
        next.markdown.set(built.doc.slug, built.markdown);
      }
      const extra = (Array.isArray(row.extra_faq) ? row.extra_faq : []).map((item: any) => ({ q: str(item?.q), a: str(item?.a) })).filter((item: FaqItem) => item.q && item.a);
      if (extra.length && SLUG.test(str(row.slug))) next.extraFaq.set(str(row.slug), extra);
    }
    const changed = JSON.stringify([...next.markdown.entries(), ...next.extraFaq.entries()]) !== JSON.stringify([...published.markdown.entries(), ...published.extraFaq.entries()]);
    published = next;
    if (changed) publishedVersionNumber += 1;
  } catch (error) {
    console.warn("[docs] published articles not loaded:", (error instanceof Error ? error.message : String(error)).slice(0, 200));
  }
}

/** A file article with any approved extra questions added to its own. */
function withExtraFaq(doc: Doc | null): Doc | null {
  if (!doc) return null;
  const extra = published.extraFaq.get(doc.slug);
  if (!extra?.length) return doc;
  const known = new Set(doc.faq.map((item) => item.q.toLowerCase()));
  const added = extra.filter((item) => !known.has(item.q.toLowerCase()));
  if (!added.length) return doc;
  // The article page cuts a "Common questions" heading out of the body when the article has FAQ items, expecting
  // them to be the same questions. When the file had none of its own, rename that heading so its body text stays.
  const html = doc.faq.length ? doc.html : doc.html.replace('<h2 id="common-questions">', '<h2 id="common-questions-body">');
  return { ...doc, html, faq: [...doc.faq, ...added] };
}

/** An article in a language, falling back to English, then to one published from the content queue. */
export function getDoc(locale: string, slug: string): Doc | null {
  return withExtraFaq(read(locale, slug) || read(DOCS_LOCALE, slug) || published.articles.get(slug) || null);
}

/**
 * An article's Markdown body without its frontmatter, falling back to English. The support assistant reads this
 * rather than the rendered HTML so it can mirror the article's own **bold** button names in its answer.
 */
export function docMarkdown(locale: string, slug: string): string | null {
  if (!SLUG.test(slug) || !/^[A-Za-z-]{2,5}$/.test(locale)) return null;
  for (const lang of [locale, DOCS_LOCALE]) {
    const path = join(DOCS, lang, `${slug}.md`);
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, "utf8").replace(/^﻿/, "");
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    return withExtraFaqText(slug, (match ? match[2] : raw).trim());
  }
  const fromQueue = published.markdown.get(slug);
  return fromQueue ? withExtraFaqText(slug, fromQueue) : null;
}

/** Approved extra questions, written onto the end of the Markdown so the support assistant can answer from them too. */
function withExtraFaqText(slug: string, markdown: string) {
  const extra = published.extraFaq.get(slug);
  if (!extra?.length) return markdown;
  return `${markdown}\n\n## More questions\n\n${extra.map((item) => `**${item.q}**\n${item.a}`).join("\n\n")}`;
}

/** Whether an article exists (in English, which every article starts in), as a file or published from the queue. */
export function docExists(slug: string) {
  return fileExists(slug) || published.articles.has(slug);
}

/** Every article, in category then reading order. */
export function listDocs(locale = DOCS_LOCALE): DocMeta[] {
  let names: string[] = [];
  try {
    names = readdirSync(join(DOCS, DOCS_LOCALE));
  } catch {
    return [];
  }
  const fileSlugs = names.filter((name) => name.endsWith(".md") && !name.startsWith("_")).map((name) => name.slice(0, -3));
  const queueSlugs = [...published.articles.keys()].filter((slug) => !fileSlugs.includes(slug));
  return [...fileSlugs, ...queueSlugs]
    .map((slug) => getDoc(locale, slug))
    .filter((doc): doc is Doc => Boolean(doc))
    .map(({ html, headings, ...meta }) => meta)
    .sort((a, b) => DOC_CATEGORIES.indexOf(a.category) - DOC_CATEGORIES.indexOf(b.category) || a.order - b.order || a.title.localeCompare(b.title));
}

/**
 * Screens several articles claim, pinned to the one that is about the whole screen (Rory, 7 Nov 2026: the "?" on
 * Settings opened the booking-page article). Keys are the path plus the query that picks the tab; checked before the
 * articles' own appPath.
 */
const SCREEN_ARTICLES: Record<string, string> = {
  "/": "dashboard",
  "/settings": "business-settings",
  "/settings?tab=business": "business-settings",
  "/settings?tab=rentals": "booking-and-price-rules",
  "/settings?tab=messaging": "inbox-and-messaging",
  "/settings?tab=notifications": "notifications",
  // Integrations (7 Nov 2026): the calendar feed is its only working row; the notifications article covers setting it up.
  "/settings?tab=integrations": "notifications",
  "/settings?tab=team": "invite-your-team",
  "/settings?tab=more": "plans-and-billing",
  "/settings/billing": "plans-and-billing",
  "/settings/notifications": "notifications",
  "/settings/contracts": "rental-agreements",
  "/bookings/new": "create-a-booking",
  "/transactions/new": "record-a-payment",
  "/transactions/new?cost=1": "add-a-cost",
  "/fleet/import": "import-a-spreadsheet",
  "/customers": "customers",
  "/inspections/start/return": "handover-checks"
};

/** "?tab=rentals&x=1" as a map, for comparing with an article's appPath. */
function queryOf(path: string) {
  const query = path.split("#")[0].split("?")[1] || "";
  return new URLSearchParams(query);
}

/**
 * The article for an app screen. The pinned list first (path plus its tab), then the most specific appPath that
 * matches ("/fleet/[id]" matches "/fleet/abc"). An appPath with a query ("/settings?tab=team") only matches that tab,
 * and beats the same path without one; one with a #section loses to one about the whole tab.
 */
export function docForAppPath(pathname: string, locale = DOCS_LOCALE): DocMeta | null {
  const path = pathname.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  const query = queryOf(pathname);
  const docs = listDocs(locale);
  const tab = query.get("tab");
  const pinned = SCREEN_ARTICLES[`${path}${tab ? `?tab=${tab}` : query.get("cost") ? `?cost=${query.get("cost")}` : ""}`] || (tab || query.get("cost") ? null : SCREEN_ARTICLES[path]);
  const pinnedDoc = pinned ? docs.find((doc) => doc.slug === pinned) : null;
  if (pinnedDoc) return pinnedDoc;
  let best: { doc: DocMeta; score: number } | null = null;
  for (const doc of docs) {
    if (!doc.appPath) continue;
    const pattern = doc.appPath.split(/[?#]/)[0].replace(/\/$/, "") || "/";
    const regex = new RegExp(`^${pattern.replace(/[.*+?^${}()|\\]/g, "\\$&").replace(/\\\[[^/]+?\\\]|\[[^/]+?\]/g, "[^/]+")}$`);
    if (!regex.test(path)) continue;
    const wanted = [...queryOf(doc.appPath).entries()];
    if (wanted.some(([key, value]) => query.get(key) !== value)) continue;
    const score = pattern.length - (pattern.match(/\[/g)?.length || 0) * 3 + wanted.length * 100 - (doc.appPath.includes("#") ? 1 : 0);
    if (!best || score > best.score) best = { doc, score };
  }
  return best?.doc || null;
}

/** A short list for search: title, description and section headings, lowercased. */
export function docSearchIndex(locale = DOCS_LOCALE) {
  return listDocs(locale).map((doc) => {
    const full = getDoc(locale, doc.slug);
    const headings = (full?.headings || []).map((heading) => heading.html.replace(/<[^>]+>/g, "")).join(" · ");
    return { slug: doc.slug, title: doc.title, description: doc.description, category: doc.category, text: `${doc.title} ${doc.description} ${headings}`.toLowerCase() };
  });
}
