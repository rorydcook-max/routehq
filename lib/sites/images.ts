/**
 * Where a website image comes from (Rory, 7 Nov 2026). Every image slot (hero, about) holds an ImageRef:
 *
 *   upload  - a photo the owner uploaded (branding bucket, <org>/branding/site/...)
 *   vehicle - one of their vehicles' photos (always the vehicle's current main photo)
 *   art     - built-in artwork drawn as SVG in the site's own colours (components/site/site-art.tsx): no download
 *   stock   - an Unsplash photo from the picker's Stock photos tab (task unsplash-lib, 8 Nov 2026; lib/stock-photos.ts).
 *             Stored as { provider: "unsplash", id, url, credit (photographer's name), creditUrl (their Unsplash
 *             profile), alt }. The url is Unsplash's own (hotlinked, never re-hosted); the site credits it as "Photo by
 *             <name> on Unsplash" in its footer, both linked with STOCK_UTM.
 *
 * Safe to import from the browser.
 */

/** The UTM parameters Unsplash asks for on every link back to them (utm_source is the app's name on Unsplash). */
export const STOCK_UTM = "utm_source=rovehq&utm_medium=referral";
export const UNSPLASH_HOME = `https://unsplash.com/?${STOCK_UTM}`;

/** A link to Unsplash (a photographer's profile) with the UTM parameters. */
export function unsplashLink(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}${STOCK_UTM}`;
}

export function isStockUrl(url: string) {
  return url.startsWith("https://images.unsplash.com/");
}

/** An Unsplash photo URL at a width (their `w` parameter); anything else comes back unchanged. */
export function stockWidth(url: string, width: number) {
  if (!isStockUrl(url)) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("w", String(width));
    return parsed.toString();
  } catch {
    return url;
  }
}

export type ArtId = "tide" | "dunes" | "sun" | "road" | "contour" | "bloom" | "palms" | "arches" | "groove" | "city" | "peaks" | "ripple" | "grid";
export const ART_IDS: ArtId[] = ["tide", "dunes", "sun", "road", "contour", "bloom", "palms", "arches", "groove", "city", "peaks", "ripple", "grid"];

export type ImageRef =
  | { kind: "upload"; path: string }
  | { kind: "vehicle"; vehicleId: string }
  | { kind: "art"; id: ArtId }
  | { kind: "stock"; provider: "unsplash"; id: string; url: string; credit: string; creditUrl: string; alt?: string };

/** Who to credit for a stock photo: the photographer's name and Unsplash profile (without UTM parameters). */
export type ImageCredit = { name: string; url: string };

/** An image ready to draw: a URL (with a credit for stock photos), or art drawn in the page's colours. */
export type ResolvedImage = { type: "url"; url: string; alt: string; credit?: ImageCredit } | { type: "art"; id: ArtId };

const record = (value: unknown): Record<string, any> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {});

/** Reads a stored ref, dropping anything malformed. */
export function imageRefFrom(value: unknown): ImageRef | null {
  const raw = record(value);
  switch (raw.kind) {
    case "upload":
      return typeof raw.path === "string" && /^[0-9a-f-]{36}\/branding\/[\w./-]{1,200}$/i.test(raw.path) && !raw.path.includes("..") ? { kind: "upload", path: raw.path } : null;
    case "vehicle":
      return typeof raw.vehicleId === "string" && /^[\w-]{1,60}$/.test(raw.vehicleId) ? { kind: "vehicle", vehicleId: raw.vehicleId } : null;
    case "art":
      return ART_IDS.includes(raw.id) ? { kind: "art", id: raw.id } : null;
    case "stock":
      return raw.provider === "unsplash" && typeof raw.url === "string" && /^https:\/\/images\.unsplash\.com\//.test(raw.url) && raw.url.length <= 600
        ? {
            kind: "stock",
            provider: "unsplash",
            id: String(raw.id || "").slice(0, 60),
            url: raw.url,
            credit: String(raw.credit || "").slice(0, 120),
            // Only a link to Unsplash itself (the photographer's profile).
            creditUrl: typeof raw.creditUrl === "string" && /^https:\/\/unsplash\.com\/[^\s"<>]{0,280}$/.test(raw.creditUrl) ? raw.creditUrl : "https://unsplash.com/",
            ...(typeof raw.alt === "string" && raw.alt.trim() ? { alt: raw.alt.trim().slice(0, 160) } : {})
          }
        : null;
    default:
      return null;
  }
}

/**
 * Turns a ref into something to draw. `uploads` maps uploaded paths to (signed) URLs; `vehiclePhotos` maps vehicle ids
 * to their main photo. A ref that can't be drawn any more (vehicle deleted, upload missing) falls back to `fallback`.
 */
export function resolveImage(
  ref: ImageRef | null,
  sources: { uploads: Record<string, string>; vehiclePhotos: Record<string, string> },
  fallback: ResolvedImage
): ResolvedImage {
  if (!ref) return fallback;
  if (ref.kind === "art") return { type: "art", id: ref.id };
  if (ref.kind === "upload") return sources.uploads[ref.path] ? { type: "url", url: sources.uploads[ref.path], alt: "" } : fallback;
  if (ref.kind === "vehicle") return sources.vehiclePhotos[ref.vehicleId] ? { type: "url", url: sources.vehiclePhotos[ref.vehicleId], alt: "" } : fallback;
  return { type: "url", url: ref.url, alt: ref.alt || "", credit: { name: ref.credit || "Unsplash", url: ref.creditUrl } };
}
