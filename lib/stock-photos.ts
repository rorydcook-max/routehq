import { stockWidth } from "@/lib/sites/images";

/**
 * Stock photos for the website builder (task unsplash-lib, 8 Nov 2026), from the Unsplash API. Server only: the access
 * key (UNSPLASH_ACCESS_KEY) never reaches the browser. Following the Unsplash API guidelines:
 *
 *   - Hotlinking: pages use photo.urls as returned (urls.regular / urls.small, only `w` changed). Nothing is re-hosted.
 *   - Download tracking: when an owner picks a photo, trackStockDownload() calls its links.download_location.
 *   - Attribution: "Photo by <name> on Unsplash", both linked with UTM parameters (lib/sites/images.ts), in the picker
 *     and on the published site.
 *
 * Demo keys allow 50 requests an hour, so searches are cached for 15 minutes and a rate limit comes back as
 * "rate_limited" for the picker to explain.
 */

const API = "https://api.unsplash.com";
const TTL_MS = 15 * 60 * 1000;
const PER_PAGE = 24;
const MAX_CACHED = 300;

export type StockPhoto = {
  id: string;
  alt: string;
  color: string | null;
  /** urls.small: the picker's grid. */
  thumb: string;
  /** urls.regular at 1920 wide: what the website shows (resized per screen with `w`). */
  url: string;
  name: string;
  /** The photographer's Unsplash profile (UTM parameters added where it is linked). */
  profileUrl: string;
  downloadLocation: string;
};

export type StockSearch = { ok: true; photos: StockPhoto[]; totalPages: number } | { ok: false; error: "not_configured" | "rate_limited" | "failed" };

const cache = new Map<string, { at: number; value: Extract<StockSearch, { ok: true }> }>();

const accessKey = () => String(process.env.UNSPLASH_ACCESS_KEY || "").trim();
const headers = () => ({ Authorization: `Client-ID ${accessKey()}`, "Accept-Version": "v1" });
const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export function stockPhotosReady() {
  return Boolean(accessKey());
}

function photoFrom(raw: any): StockPhoto | null {
  const id = text(raw?.id, 40);
  const regular = text(raw?.urls?.regular, 600);
  const small = text(raw?.urls?.small, 600);
  const downloadLocation = text(raw?.links?.download_location, 600);
  const profileUrl = text(raw?.user?.links?.html, 300);
  if (!/^[\w-]+$/.test(id) || !regular.startsWith("https://images.unsplash.com/") || !small.startsWith("https://images.unsplash.com/")) return null;
  if (!downloadLocation.startsWith(`${API}/photos/${id}/download`) || !profileUrl.startsWith("https://unsplash.com/")) return null;
  return {
    id,
    alt: text(raw?.alt_description, 160) || text(raw?.description, 160),
    color: /^#[0-9a-f]{6}$/i.test(String(raw?.color || "")) ? raw.color : null,
    thumb: stockWidth(small, 480),
    url: stockWidth(regular, 1920),
    name: text(raw?.user?.name, 120) || text(raw?.user?.username, 120) || "Unsplash",
    profileUrl,
    downloadLocation
  };
}

/** One page of landscape photos for a search (safe-search on), cached for a while. */
export async function searchStockPhotos(query: string, page = 1): Promise<StockSearch> {
  const q = query.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!accessKey()) return { ok: false, error: "not_configured" };
  const cacheKey = `${q.toLowerCase()}|${page}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const params = new URLSearchParams({ query: q, page: String(page), per_page: String(PER_PAGE), orientation: "landscape", content_filter: "high" });
  let response: Response;
  try {
    response = await fetch(`${API}/search/photos?${params.toString()}`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(8000) });
  } catch {
    return { ok: false, error: "failed" };
  }
  // Unsplash answers 403 ("Rate Limit Exceeded") once the hour's requests are used up; 429 just in case.
  if (response.status === 403 || response.status === 429) return { ok: false, error: "rate_limited" };
  if (!response.ok) return { ok: false, error: "failed" };
  const body = await response.json().catch(() => null);
  if (!body || !Array.isArray(body.results)) return { ok: false, error: "failed" };

  const value = { ok: true as const, photos: body.results.map(photoFrom).filter(Boolean) as StockPhoto[], totalPages: Math.min(Number(body.total_pages) || 0, 50) };
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string);
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
}

/**
 * Tells Unsplash a photo was chosen (their "download" event), by calling its links.download_location. Only that
 * photo's own endpoint is called, whatever the browser sent. Returns the HTTP status, or null when it couldn't be sent.
 */
export async function trackStockDownload(id: string, downloadLocation: string): Promise<number | null> {
  if (!accessKey() || !/^[\w-]{1,40}$/.test(id)) return null;
  const own = `${API}/photos/${id}/download`;
  const target = downloadLocation.startsWith(`${own}?`) || downloadLocation === own ? downloadLocation : own;
  try {
    const response = await fetch(target, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(8000) });
    return response.status;
  } catch {
    return null;
  }
}

const KIND_QUERY: Record<string, string> = { atv: "atv", car: "car", ebike: "e-bike", motorbike: "motorcycle", scooter: "scooter", van: "camper van" };

/** Searches to suggest in the picker for this business: its town and country, the coast, road trips and its vehicle types, alphabetical. */
export function stockSuggestions({ town, countryCode, kinds }: { town?: string | null; countryCode?: string | null; kinds: string[] }): string[] {
  let country = "";
  try {
    if (countryCode && /^[A-Z]{2}$/i.test(countryCode)) country = new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode.toUpperCase()) || "";
  } catch {
    country = "";
  }
  const all = [String(town || "").trim(), country, "coast", "road trip", ...kinds.map((kind) => KIND_QUERY[kind] || "")].filter(Boolean);
  return all.filter((item, index) => all.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}
