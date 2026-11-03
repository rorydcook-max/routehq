import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { renderMarkdown, type Heading } from "@/lib/site/content";
import { LEGAL_SLUGS, type LegalSlug } from "@/lib/site/legal-slugs";

/**
 * RoveHQ's legal pages (GDPR / UK GDPR / Thai PDPA work, 3 Nov 2026): privacy policy, terms of service, data processing
 * agreement, sub-processors and cookie policy, at /legal/<slug> on the website.
 * content/legal/<locale>/<slug>.md, Markdown with YAML frontmatter (title, description, updated, order). Written in
 * English only for now (Rory: written from public ICO/EDPB/Commission/PDPC guidance, not reviewed by lawyers); every
 * other language shows the English text, with the English address as canonical, as the help centre does.
 * The proxy imports only lib/site/legal-slugs.ts; this file reads the disk.
 */

const LEGAL = join(process.cwd(), "content", "legal");
export const LEGAL_LOCALE = "en";

export type LegalDoc = { slug: LegalSlug; locale: string; title: string; description: string; updated: string; order: number; html: string; headings: Heading[] };

const cache = new Map<string, { mtime: number; value: LegalDoc | null }>();
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

function isoDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = str(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

function read(locale: string, slug: LegalSlug, pageLocale: string): LegalDoc | null {
  const path = join(LEGAL, locale, `${slug}.md`);
  let mtime: number;
  try {
    mtime = statSync(path).mtimeMs;
  } catch {
    return null;
  }
  const key = `${path}|${pageLocale}`;
  const hit = cache.get(key);
  if (hit && hit.mtime === mtime) return hit.value;
  const raw = readFileSync(path, "utf8").replace(/^﻿/, "");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const data = (match ? parseYaml(match[1]) : {}) as Record<string, unknown>;
  const body = match ? match[2] : raw;
  // Links to other website pages keep the language of the page being shown.
  const { html, headings } = renderMarkdown(body, pageLocale);
  const value: LegalDoc = {
    slug,
    locale,
    title: str(data?.title) || slug,
    description: str(data?.description),
    updated: isoDate(data?.updated),
    order: Number.isFinite(Number(data?.order)) ? Number(data.order) : 99,
    html,
    headings
  };
  cache.set(key, { mtime, value });
  return value;
}

export function isLegalSlug(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug);
}

/** A legal page in a language, or the English one when it hasn't been translated. */
export function getLegalDoc(locale: string, slug: string): LegalDoc | null {
  if (!isLegalSlug(slug)) return null;
  if (/^[A-Za-z-]{2,5}$/.test(locale) && locale !== LEGAL_LOCALE) {
    const own = read(locale, slug, locale);
    if (own) return own;
  }
  return read(LEGAL_LOCALE, slug, locale);
}

/** Every legal page, in order. */
export function listLegalDocs(locale: string): LegalDoc[] {
  return LEGAL_SLUGS.map((slug) => getLegalDoc(locale, slug))
    .filter((doc): doc is LegalDoc => Boolean(doc))
    .sort((a, b) => a.order - b.order);
}
