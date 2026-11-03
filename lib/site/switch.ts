import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { softwareBySlug, type Software } from "@/lib/import/software";
import { renderMarkdown, type FaqItem } from "@/lib/site/content";

/**
 * The website's "Switch to RoveHQ" pages, one per rental software (content/switch/<locale>/<slug>.md, the slug as in
 * lib/import/software.ts). Written in English first: a language without its own copy shows the English one (with
 * the English address as canonical), like the help centre. Plain names only, no logos; facts from the software's own
 * help pages (docs/competitor-exports.md).
 */

const DIR = join(process.cwd(), "content", "switch");
export const SWITCH_LOCALE = "en";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const locales = new Set<string>(supportedLocaleCodes);

export type SwitchPage = {
  slug: string;
  locale: string;
  title: string;
  description: string;
  updated: string;
  software: Software;
  /** What can be exported from it, in its own words. */
  exports: string[];
  steps: string[];
  faq: FaqItem[];
  html: string;
};

const cache = new Map<string, { mtime: number; page: SwitchPage | null }>();
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());
const list = (value: unknown) => (Array.isArray(value) ? value.map(str).filter(Boolean) : []);

function read(locale: string, slug: string): SwitchPage | null {
  if (!locales.has(locale) || !SLUG.test(slug)) return null;
  const path = join(DIR, locale, `${slug}.md`);
  let mtime: number;
  try {
    mtime = statSync(path).mtimeMs;
  } catch {
    return null;
  }
  const hit = cache.get(path);
  if (hit && hit.mtime === mtime) return hit.page;
  const raw = readFileSync(path, "utf8").replace(/^﻿/, "");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const data = (match ? parseYaml(match[1]) : {}) as Record<string, unknown>;
  const software = softwareBySlug(slug);
  const page: SwitchPage | null = software
    ? {
        slug,
        locale,
        title: str(data.title) || software.name,
        description: str(data.description),
        updated: data.updated instanceof Date ? data.updated.toISOString().slice(0, 10) : str(data.updated).slice(0, 10),
        software,
        exports: list(data.exports),
        steps: list(data.steps),
        faq: Array.isArray(data.faq) ? (data.faq as any[]).map((item) => ({ q: str(item?.q), a: str(item?.a) })).filter((item) => item.q && item.a) : [],
        html: renderMarkdown(match ? match[2] : raw, locale).html
      }
    : null;
  cache.set(path, { mtime, page });
  return page;
}

/** The page in a language, else the English one; null when there is none. */
export function getSwitchPage(locale: string, slug: string): SwitchPage | null {
  return read(locale, slug) || read(SWITCH_LOCALE, slug);
}

/** Every switching page (English list), by software name. */
export function listSwitchPages(locale: string = SWITCH_LOCALE): SwitchPage[] {
  let names: string[] = [];
  try {
    names = readdirSync(join(DIR, SWITCH_LOCALE));
  } catch {
    names = [];
  }
  return names
    .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
    .map((name) => getSwitchPage(locale, name.slice(0, -3)))
    .filter((page): page is SwitchPage => Boolean(page))
    .sort((a, b) => a.software.name.localeCompare(b.software.name));
}
