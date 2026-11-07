import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { siteOrigin } from "@/lib/site/seo";

/**
 * Cover images for the guides and free resources. An article names its own in frontmatter (`cover: /site/covers/contract.svg`,
 * `coverAlt: "…"`); without one it gets a topic illustration picked from its slug, then its guide topic, so a new article
 * never shows up bare. The illustrations are flat SVGs in the site's colours (public/site/covers), each with a 1200×630 PNG
 * rendition in public/site/covers/og for Open Graph, which doesn't take SVG.
 */

const PUBLIC = join(process.cwd(), "public");

export const COVER_ART = {
  scooter: "Illustration: a scooter by the sea",
  car: "Illustration: a rental car by the sea",
  contract: "Illustration: a rental agreement with a signature",
  handover: "Illustration: a handover checklist and a vehicle key",
  deposit: "Illustration: a stack of coins and a lock for a held deposit",
  insurance: "Illustration: a shield protecting a rental car",
  plates: "Illustration: a vehicle registration plate",
  compare: "Illustration: a balance weighing two software options",
  spreadsheet: "Illustration: a spreadsheet next to a phone showing a booking calendar",
  messages: "Illustration: a phone with chat messages to a renter",
  calculator: "Illustration: a calculator working out rental prices and profit",
  calendar: "Illustration: a booking calendar with rentals as bars",
  island: "Illustration: an island with a palm tree and a ferry"
} as const;
export type CoverArt = keyof typeof COVER_ART;

/** Topic illustration for each guide topic (lib/site/content.ts GUIDE_CATEGORIES). */
const BY_CATEGORY: Record<string, CoverArt> = { starting: "island", legal: "contract", operations: "calendar", money: "deposit", marketing: "messages" };

/** Words in a slug that pick an illustration, checked in order. */
const BY_SLUG: Array<[RegExp, CoverArt]> = [
  [/spreadsheet/, "spreadsheet"],
  [/(^|-)vs-|alternative/, "compare"],
  [/agreement|contract/, "contract"],
  [/handover|checklist|inspection/, "handover"],
  [/deposit/, "deposit"],
  [/insurance/, "insurance"],
  [/plate|registration/, "plates"],
  [/message|template|whatsapp|line-/, "messages"],
  [/pricing|calculator|profit/, "calculator"],
  [/scooter|motorbike|motorcycle/, "scooter"],
  [/car-/, "car"]
];

export type Cover = { src: string; alt: string; og: string | null; width: number; height: number };

const artPath = (art: CoverArt) => `/site/covers/${art}.svg`;

/** The illustration a slug (and guide topic) falls back to. */
export function fallbackArt(slug: string, category?: string | null): CoverArt {
  for (const [pattern, art] of BY_SLUG) if (pattern.test(slug)) return art;
  return (category && BY_CATEGORY[category]) || "island";
}

/** A raster file's own address, or the PNG rendition beside an SVG cover; null when there's none on disk. */
function ogFor(src: string): string | null {
  if (/^https?:\/\//.test(src)) return src;
  const png = src.endsWith(".svg") ? src.replace(/\/([^/]+)\.svg$/, "/og/$1.png") : src;
  return existsSync(join(PUBLIC, png)) ? png : null;
}

/**
 * An article's cover: its own (`cover`, a site path or https address) when set and present, else the topic illustration.
 * `alt` is the frontmatter's coverAlt, else "" (the illustration only repeats the title, so it's decorative).
 */
export function coverFor({ slug, category, cover, coverAlt }: { slug: string; category?: string | null; cover?: string | null; coverAlt?: string | null }): Cover {
  const own = cover && (/^https:\/\//.test(cover) || (cover.startsWith("/") && !cover.includes("..") && existsSync(join(PUBLIC, cover)))) ? cover : null;
  const art = fallbackArt(slug, category);
  const src = own || artPath(art);
  const size = imageSize(src) || { width: 1200, height: 630 };
  return { src, alt: coverAlt || "", og: ogFor(src), ...size };
}

/** The cover's Open Graph image, absolute on the website's own origin (the root metadataBase is the app's), or null. */
export function coverOgImage(cover: Cover, fallbackAlt: string) {
  if (!cover.og) return null;
  const url = /^https?:\/\//.test(cover.og) ? cover.og : `${siteOrigin()}${cover.og}`;
  return { url, width: 1200, height: 630, alt: cover.alt || fallbackAlt };
}

/* ── Image sizes for local files, so every <img> has width and height (no layout shift) ── */

const sizeCache = new Map<string, { mtime: number; size: { width: number; height: number } | null }>();

/** Width and height of an image under public/ (SVG, PNG, WebP or JPEG), or null when it can't be read. */
export function imageSize(src: string): { width: number; height: number } | null {
  if (!src.startsWith("/") || src.includes("..")) return null;
  const path = join(PUBLIC, src.split(/[?#]/)[0]);
  let mtime: number;
  try {
    mtime = statSync(path).mtimeMs;
  } catch {
    return null;
  }
  const hit = sizeCache.get(path);
  if (hit && hit.mtime === mtime) return hit.size;
  let size: { width: number; height: number } | null = null;
  try {
    const buf = readFileSync(path);
    size = readSize(buf, path.toLowerCase());
  } catch {
    size = null;
  }
  sizeCache.set(path, { mtime, size });
  return size;
}

function readSize(buf: Buffer, path: string): { width: number; height: number } | null {
  if (path.endsWith(".svg")) {
    const head = buf.toString("utf8", 0, 2000);
    const w = head.match(/<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/);
    const h = head.match(/<svg[^>]*\sheight="(\d+(?:\.\d+)?)"/);
    if (w && h) return { width: Math.round(Number(w[1])), height: Math.round(Number(h[1])) };
    const box = head.match(/viewBox="[\d.\s-]*?\s(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)"/);
    return box ? { width: Math.round(Number(box[1])), height: Math.round(Number(box[2])) } : null;
  }
  if (buf.toString("ascii", 1, 4) === "PNG") return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const kind = buf.toString("ascii", 12, 16);
    if (kind === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (kind === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
    }
    return null;
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const length = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      i += 2 + length;
    }
  }
  return null;
}
