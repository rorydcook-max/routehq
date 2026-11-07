/**
 * Where a website image comes from (Rory, 7 Nov 2026). Every image slot (hero, about) holds an ImageRef:
 *
 *   upload  - a photo the owner uploaded (branding bucket, <org>/branding/site/...)
 *   vehicle - one of their vehicles' photos (always the vehicle's current main photo)
 *   art     - built-in artwork drawn as SVG in the site's own colours (components/site/site-art.tsx): no download
 *   stock   - a stock photo from a library.
 *
 * TODO(phase 2): a stock library through the Unsplash API. It needs RoveHQ's Unsplash access key (owner to provide)
 * and their attribution rules: store { provider: "unsplash", id, url, credit, creditUrl } from the picker, show the
 * credit under the image, and call Unsplash's download endpoint when one is chosen. imageRefFrom() already keeps
 * such refs; the picker and the credit line are what's missing.
 *
 * Safe to import from the browser.
 */

export type ArtId = "tide" | "dunes" | "sun" | "road" | "contour" | "bloom";
export const ART_IDS: ArtId[] = ["tide", "dunes", "sun", "road", "contour", "bloom"];

export type ImageRef =
  | { kind: "upload"; path: string }
  | { kind: "vehicle"; vehicleId: string }
  | { kind: "art"; id: ArtId }
  | { kind: "stock"; provider: "unsplash"; id: string; url: string; credit: string; creditUrl: string };

/** An image ready to draw: a URL, or art drawn in the page's colours. */
export type ResolvedImage = { type: "url"; url: string; alt: string } | { type: "art"; id: ArtId };

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
      return raw.provider === "unsplash" && typeof raw.url === "string" && /^https:\/\/images\.unsplash\.com\//.test(raw.url)
        ? { kind: "stock", provider: "unsplash", id: String(raw.id || "").slice(0, 60), url: raw.url, credit: String(raw.credit || "").slice(0, 120), creditUrl: String(raw.creditUrl || "").slice(0, 300) }
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
  return { type: "url", url: ref.url, alt: "" };
}
