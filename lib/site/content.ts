import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Marked } from "marked";
import { parse as parseYaml } from "yaml";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { localizeSitePath } from "@/lib/site/locale-path";

/**
 * The website's written content: guides (content/guides/<locale>/<slug>.md) and free resources
 * (content/resources/<locale>/<slug>.md, with the downloadable files in downloads/<slug>/<locale>.<ext>, outside
 * public/ so they are only ever served through a signed link). Markdown with YAML frontmatter, read on the server.
 *
 * A slug is the same in every language, so hreflang can pair the translations; a language without the file simply
 * has no page for it (404, and it is left out of hreflang and the sitemap). Files starting with "_" are drafts.
 * Raw HTML in a file is shown as text, never rendered: the Markdown is the only markup.
 */

const CONTENT = join(process.cwd(), "content");
const DOWNLOADS = join(process.cwd(), "downloads");

export const GUIDE_CATEGORIES = ["starting", "legal", "operations", "money", "marketing"] as const;
export type GuideCategory = (typeof GUIDE_CATEGORIES)[number];
export const DOWNLOAD_FORMATS = ["docx", "pdf", "xlsx"] as const;
export type DownloadFormat = (typeof DOWNLOAD_FORMATS)[number];

export type FaqItem = { q: string; a: string };
export type Heading = { id: string; html: string };

export type GuideMeta = {
  slug: string;
  locale: string;
  title: string;
  description: string;
  date: string;
  updated: string;
  category: GuideCategory;
  country: string | null;
  readingMinutes: number;
  leadMagnet: string | null;
  faq: FaqItem[];
  cover: string | null;
};
export type Guide = GuideMeta & { html: string; headings: Heading[] };

export type ResourceMeta = {
  slug: string;
  locale: string;
  title: string;
  description: string;
  fileLabel: string;
  inside: string[];
  formats: DownloadFormat[];
  date: string;
};
export type Resource = ResourceMeta & { html: string };
export type ResourceFile = { locale: string; format: DownloadFormat; bytes: number };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const locales = new Set<string>(supportedLocaleCodes);
export const isContentSlug = (slug: string) => SLUG.test(slug);

/* ── Reading files, remembered until the file changes ─────────────────── */

const cache = new Map<string, { mtime: number; value: unknown }>();

function cached<T>(path: string, read: (raw: string) => T): T | null {
  let mtime: number;
  try {
    mtime = statSync(path).mtimeMs;
  } catch {
    return null;
  }
  const hit = cache.get(path);
  if (hit && hit.mtime === mtime) return hit.value as T;
  const value = read(readFileSync(path, "utf8"));
  cache.set(path, { mtime, value });
  return value;
}

function listDir(path: string) {
  try {
    return readdirSync(path);
  } catch {
    return [] as string[];
  }
}

function splitFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = raw.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data = parseYaml(match[1]);
  return { data: data && typeof data === "object" ? (data as Record<string, unknown>) : {}, body: match[2] };
}

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());
const list = (value: unknown) => (Array.isArray(value) ? value.map(str).filter(Boolean) : []);

function isoDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = str(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

/** Scripts written without spaces between words are counted by characters. */
const NO_SPACES = new Set(["th", "lo", "my", "zh", "zh-TW", "ja"]);

export function estimateReadingMinutes(body: string, locale: string) {
  const text = body.replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`|[\]()!-]/g, " ");
  const minutes = NO_SPACES.has(locale) ? text.replace(/\s+/g, "").length / 450 : text.split(/\s+/).filter(Boolean).length / 220;
  return Math.max(1, Math.round(minutes));
}

/* ── Markdown ─────────────────────────────────────────────────────────── */

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const decodeEntities = (text: string) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

export function headingId(text: string) {
  const id = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return id || "section";
}

/** Markdown to HTML: heading ids (H2s become the table of contents), website links kept in the page's language, tables that scroll on phones. */
export function renderMarkdown(body: string, locale: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  const marked = new Marked({ gfm: true, async: false });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        const base = headingId(decodeEntities(inner.replace(/<[^>]+>/g, "")));
        const seen = used.get(base) || 0;
        used.set(base, seen + 1);
        const id = seen ? `${base}-${seen + 1}` : base;
        if (depth === 2) headings.push({ id, html: inner });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      // Raw HTML in a content file is shown as text: Markdown is the only markup.
      html({ text }) {
        return escapeHtml(text);
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const external = /^https?:\/\//i.test(href);
        const safe = /^(https?:\/\/|mailto:|\/|#)/i.test(href) ? href : "#";
        const target = safe.startsWith("/") ? localizeSitePath(safe, locale) : safe;
        return `<a href="${escapeHtml(target)}"${title ? ` title="${escapeHtml(title)}"` : ""}${external ? ' rel="noopener noreferrer" target="_blank"' : ""}>${inner}</a>`;
      },
      image({ href, title, text }) {
        const safe = /^(https?:\/\/|\/)/i.test(href) ? href : "";
        if (!safe) return escapeHtml(text);
        return `<img src="${escapeHtml(safe)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ""} loading="lazy" decoding="async">`;
      }
    }
  });
  const html = (marked.parse(body) as string).replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>");
  return { html, headings };
}

/* ── Guides ───────────────────────────────────────────────────────────── */

const guidePath = (locale: string, slug: string) => join(CONTENT, "guides", locale, `${slug}.md`);

function readGuide(locale: string, slug: string): Guide | null {
  if (!locales.has(locale) || !SLUG.test(slug)) return null;
  return cached(guidePath(locale, slug), (raw) => {
    const { data, body } = splitFrontmatter(raw);
    const category = (GUIDE_CATEGORIES as readonly string[]).includes(str(data.category)) ? (str(data.category) as GuideCategory) : "operations";
    const faq = Array.isArray(data.faq)
      ? (data.faq as unknown[]).map((item) => (item && typeof item === "object" ? { q: str((item as any).q), a: str((item as any).a) } : null)).filter((item): item is FaqItem => Boolean(item?.q && item?.a))
      : [];
    const date = isoDate(data.date);
    const { html, headings } = renderMarkdown(body, locale);
    const minutes = Number(data.readingMinutes);
    return {
      slug,
      locale,
      title: str(data.title) || slug,
      description: str(data.description),
      date,
      updated: isoDate(data.updated) || date,
      category,
      country: str(data.country) || null,
      readingMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : estimateReadingMinutes(body, locale),
      leadMagnet: SLUG.test(str(data.leadMagnet)) ? str(data.leadMagnet) : null,
      faq,
      cover: str(data.cover) || null,
      html,
      headings,
      draft: data.draft === true
    } as Guide & { draft: boolean };
  });
}

const isDraft = (item: unknown) => Boolean((item as { draft?: boolean } | null)?.draft);

/** A guide in a language, or null when it has not been written (or translated) yet. */
export function getGuide(locale: string, slug: string): Guide | null {
  const guide = readGuide(locale, slug);
  return guide && !isDraft(guide) ? guide : null;
}

/** Every published guide in a language, newest first. */
export function listGuides(locale: string): GuideMeta[] {
  if (!locales.has(locale)) return [];
  return listDir(join(CONTENT, "guides", locale))
    .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
    .map((name) => getGuide(locale, name.slice(0, -3)))
    .filter((guide): guide is Guide => Boolean(guide))
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

/** The languages a guide has been written in. */
export function guideLocales(slug: string): string[] {
  if (!SLUG.test(slug)) return [];
  return supportedLocaleCodes.filter((locale) => existsSync(guidePath(locale, slug)) && getGuide(locale, slug));
}

/** Every guide slug in any language (for the sitemap). */
export function allGuideSlugs(): string[] {
  const slugs = new Set<string>();
  for (const locale of supportedLocaleCodes) for (const guide of listGuides(locale)) slugs.add(guide.slug);
  return [...slugs];
}

/* ── Free resources (lead magnets) ────────────────────────────────────── */

const resourcePath = (locale: string, slug: string) => join(CONTENT, "resources", locale, `${slug}.md`);

function readResource(locale: string, slug: string): Resource | null {
  if (!locales.has(locale) || !SLUG.test(slug)) return null;
  return cached(resourcePath(locale, slug), (raw) => {
    const { data, body } = splitFrontmatter(raw);
    const formats = list(data.formats).filter((format): format is DownloadFormat => (DOWNLOAD_FORMATS as readonly string[]).includes(format));
    return {
      slug,
      locale,
      title: str(data.title) || slug,
      description: str(data.description),
      fileLabel: str(data.fileLabel),
      inside: list(data.inside),
      formats: formats.length ? formats : ["pdf"],
      date: isoDate(data.date),
      html: renderMarkdown(body, locale).html,
      draft: data.draft === true
    } as Resource & { draft: boolean };
  });
}

/** A free resource's landing page text in a language, or null when it has none. */
export function getResource(locale: string, slug: string): Resource | null {
  const resource = readResource(locale, slug);
  return resource && !isDraft(resource) ? resource : null;
}

/** Every published resource in a language. */
export function listResources(locale: string): ResourceMeta[] {
  if (!locales.has(locale)) return [];
  return listDir(join(CONTENT, "resources", locale))
    .filter((name) => name.endsWith(".md") && !name.endsWith(".template.md") && !name.startsWith("_"))
    .map((name) => getResource(locale, name.slice(0, -3)))
    .filter((resource): resource is Resource => Boolean(resource))
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export function resourceLocales(slug: string): string[] {
  if (!SLUG.test(slug)) return [];
  return supportedLocaleCodes.filter((locale) => existsSync(resourcePath(locale, slug)) && getResource(locale, slug));
}

export function allResourceSlugs(): string[] {
  const slugs = new Set<string>();
  for (const locale of supportedLocaleCodes) for (const resource of listResources(locale)) slugs.add(resource.slug);
  return [...slugs];
}

/** The first sections of a resource's template text (content/resources/<locale>/<slug>.template.md), as a preview. */
export function resourcePreview(locale: string, slug: string): string | null {
  if (!locales.has(locale) || !SLUG.test(slug)) return null;
  return cached(join(CONTENT, "resources", locale, `${slug}.template.md`), (raw) => {
    const { body } = splitFrontmatter(raw.replace(/^\uFEFF/, ""));
    // The title block and the first two sections: everything before the third "## " heading.
    const parts = body.split(/^(?=## )/m);
    return renderMarkdown(parts.slice(0, 3).join(""), locale).html;
  });
}

/** The downloadable files a resource has (downloads/<slug>/<locale>.<format>), any language. */
export function resourceFiles(slug: string): ResourceFile[] {
  if (!SLUG.test(slug)) return [];
  const files: ResourceFile[] = [];
  for (const name of listDir(join(DOWNLOADS, slug))) {
    const match = name.match(/^([A-Za-z]{2,3}(?:-[A-Za-z]{2})?)\.(docx|pdf|xlsx)$/);
    if (!match || !locales.has(match[1])) continue;
    try {
      const bytes = statSync(join(DOWNLOADS, slug, name)).size;
      if (bytes > 0) files.push({ locale: match[1], format: match[2] as DownloadFormat, bytes });
    } catch {
      // Gone between listing and reading: skip it.
    }
  }
  return files;
}

/** Where a download lives on disk, or null when the request does not name a real file. */
export function downloadFilePath(slug: string, locale: string, format: string): string | null {
  if (!SLUG.test(slug) || !locales.has(locale) || !(DOWNLOAD_FORMATS as readonly string[]).includes(format)) return null;
  const path = join(DOWNLOADS, slug, `${locale}.${format}`);
  return existsSync(path) ? path : null;
}
