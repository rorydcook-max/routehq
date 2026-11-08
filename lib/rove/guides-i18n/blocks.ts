import type { GuideBlock } from "@/lib/rove/guides";

/**
 * The renter guides in other languages (task rove-guides-i18n, 8 Nov 2026): one file per language, each a
 * translation of lib/rove/guides.ts keyed by slug. Only the words are here; slugs, dates, related destinations and
 * sources stay in guides.ts. A guide missing from a language's file is shown in English (localizedGuide).
 * When an English guide changes, change every language's copy too: the facts must stay the same.
 */
export type GuideText = { title: string; description: string; standfirst: string; body: GuideBlock[] };
export type GuideTranslations = Record<string, GuideText>;

export const h = (text: string): GuideBlock => ({ type: "h2", text });
export const p = (text: string): GuideBlock => ({ type: "p", text });
export const ul = (items: string[]): GuideBlock => ({ type: "ul", items });
