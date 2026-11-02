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

/** An article in a language, falling back to English. */
export function getDoc(locale: string, slug: string): Doc | null {
  return read(locale, slug) || read(DOCS_LOCALE, slug);
}

/** Whether an article exists (in English, which every article starts in). */
export function docExists(slug: string) {
  return SLUG.test(slug) && existsSync(join(DOCS, DOCS_LOCALE, `${slug}.md`));
}

/** Every article, in category then reading order. */
export function listDocs(locale = DOCS_LOCALE): DocMeta[] {
  let names: string[] = [];
  try {
    names = readdirSync(join(DOCS, DOCS_LOCALE));
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
    .map((name) => getDoc(locale, name.slice(0, -3)))
    .filter((doc): doc is Doc => Boolean(doc))
    .map(({ html, headings, ...meta }) => meta)
    .sort((a, b) => DOC_CATEGORIES.indexOf(a.category) - DOC_CATEGORIES.indexOf(b.category) || a.order - b.order || a.title.localeCompare(b.title));
}

/** The article for an app screen: the most specific appPath that matches ("/fleet/[id]" matches "/fleet/abc"). */
export function docForAppPath(pathname: string, locale = DOCS_LOCALE): DocMeta | null {
  const path = pathname.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  let best: { doc: DocMeta; score: number } | null = null;
  for (const doc of listDocs(locale)) {
    if (!doc.appPath) continue;
    const pattern = doc.appPath.split(/[?#]/)[0].replace(/\/$/, "") || "/";
    const regex = new RegExp(`^${pattern.replace(/[.*+?^${}()|\\]/g, "\\$&").replace(/\\\[[^/]+?\\\]|\[[^/]+?\]/g, "[^/]+")}$`);
    if (!regex.test(path)) continue;
    const score = pattern.length - (pattern.match(/\[/g)?.length || 0) * 3;
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
