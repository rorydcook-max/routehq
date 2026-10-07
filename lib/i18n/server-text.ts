import { getLocale } from "next-intl/server";

/**
 * Sentences the server sends back when something can't be done ("That vehicle
 * is no longer free...") are written in English where they arise. `said` puts
 * one into the reader's language on its way out, from a per-language list
 * keyed by the English sentence (locales/<lang>/server-text.json). A sentence
 * with a changing part is listed with {} in its place. Anything not listed
 * goes out in English, as before.
 */

type Dictionary = { exact: Record<string, string>; patterns: Array<{ test: RegExp; to: string }> };

const cache = new Map<string, Dictionary | null>();

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildDictionary(raw: Record<string, string>): Dictionary {
  const exact: Record<string, string> = {};
  const patterns: Dictionary["patterns"] = [];
  for (const [english, translated] of Object.entries(raw)) {
    if (english.includes("{}")) patterns.push({ test: new RegExp(`^${english.split("{}").map(escapeRegExp).join("(.+?)")}$`, "s"), to: translated });
    else exact[english] = translated;
  }
  return { exact, patterns };
}

async function dictionaryFor(locale: string): Promise<Dictionary | null> {
  if (cache.has(locale)) return cache.get(locale) || null;
  let found: Dictionary | null = null;
  try {
    found = buildDictionary((await import(`@/locales/${locale}/server-text.json`)).default as Record<string, string>);
  } catch {
    found = null;
  }
  cache.set(locale, found);
  return found;
}

export function translate(message: string, dictionary: Dictionary, depth = 0): string {
  const text = message.trim();
  if (dictionary.exact[text]) return dictionary.exact[text];
  if (depth > 1) return message;
  for (const pattern of dictionary.patterns) {
    const match = text.match(pattern.test);
    if (!match) continue;
    let index = 0;
    // The changing part may itself be a listed sentence (a reason inside "Can't approve this: {}.").
    return pattern.to.replace(/\{\}/g, () => translate(String(match[++index] || ""), dictionary, depth + 1));
  }
  return message;
}

export async function said(message: string): Promise<string> {
  try {
    const locale = await getLocale();
    if (!locale || locale === "en") return message;
    const dictionary = await dictionaryFor(locale);
    return dictionary ? translate(String(message || ""), dictionary) : message;
  } catch {
    return message;
  }
}
