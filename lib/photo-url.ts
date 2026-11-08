/**
 * Public vehicle and website photos (task build-img, 8 Nov 2026). They are served from one stable, cacheable address,
 * app/api/rove-photo, never a signed storage link (those expire after hours, so shared links showed broken pictures),
 * and at the size the slot needs: `?w=` picks a width from PHOTO_WIDTHS, served as WebP (`&f=jpg` for share previews).
 *
 * Safe to import from the browser.
 */

export const PHOTO_ROUTE = "/api/rove-photo/";
// 800 (task perf, 8 Nov 2026): a full-width photo on a phone (about 700px at its pixel density) took the 960 size.
export const PHOTO_WIDTHS = [160, 320, 480, 640, 800, 960, 1280, 1600] as const;

/**
 * The small "AI image" label on rove.rent and booking pages, shown on AI-generated (not enhanced) photos.
 * Rory hasn't confirmed it yet (8 Nov 2026): set to false to hide it everywhere.
 */
export const SHOW_AI_IMAGE_LABEL = true;

/** A stored photo at its stable address. `version` (a few characters of its storage path) changes when the file does. */
export function vehiclePhotoAddress(vehicleId: string, documentId: string, storagePath: string) {
  return `${PHOTO_ROUTE}${vehicleId}/${documentId}?v=${shortHash(storagePath)}`;
}

/** An uploaded website image (branding bucket, <org>/branding/site/...) at its stable address. */
export function sitePhotoAddress(storagePath: string) {
  return `${PHOTO_ROUTE}site/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
}

export function isServedPhoto(url: string | null | undefined): url is string {
  if (!url) return false;
  const path = url.replace(/^https?:\/\/[^/]+/, "");
  return path.startsWith(PHOTO_ROUTE);
}

/** The photo at a width (and format). Other URLs (demo images, stock) come back unchanged. */
export function sizedPhoto(url: string, width: number, format?: "jpg"): string {
  if (!isServedPhoto(url)) return url;
  const [base, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  params.set("w", String(width));
  if (format) params.set("f", format);
  return `${base}?${params.toString()}`;
}

/** srcset for a served photo, or undefined for anything else (it then loads as it is). */
export function photoSrcSet(url: string | null | undefined, widths: readonly number[] = PHOTO_WIDTHS): string | undefined {
  if (!isServedPhoto(url)) return undefined;
  return widths.map((width) => `${sizedPhoto(url, width)} ${width}w`).join(", ");
}

/** src + srcSet + sizes for an <img>: `fallback` is the width used by browsers without srcset support. */
export function photoProps(url: string, sizes: string, fallback = 960) {
  return isServedPhoto(url) ? { src: sizedPhoto(url, fallback), srcSet: photoSrcSet(url), sizes } : { src: url };
}

function shortHash(text: string) {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
  return hash.toString(36);
}
