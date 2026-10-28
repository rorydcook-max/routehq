import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed download links for the website's free resources. A link names one file (resource, language, format) and
 * expires after 7 days; app/api/download/[slug]/route.ts serves the file only for a valid, unexpired signature.
 *
 * The key is DOWNLOAD_SECRET; until that is set, one is derived from the Supabase service-role key (server-only),
 * so links work out of the box and change if either secret is rotated.
 */

export const DOWNLOAD_TTL_SECONDS = 7 * 24 * 60 * 60;

/** lead: for a personalised file (the contract builder), the lead whose details it is built from. */
export type DownloadClaim = { slug: string; locale: string; format: string; exp: number; lead?: string };

function secret(): Buffer | null {
  const own = process.env.DOWNLOAD_SECRET;
  if (own && own.length >= 16) return Buffer.from(own);
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!fallback) return null;
  return createHmac("sha256", fallback).update("routehq-download-links-v1").digest();
}

const b64 = (value: Buffer | string) => Buffer.from(value).toString("base64url");

function sign(payload: string, key: Buffer) {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** A token for one file, or null when no secret is configured. */
export function createDownloadToken(claim: Omit<DownloadClaim, "exp">, ttlSeconds = DOWNLOAD_TTL_SECONDS): string | null {
  const key = secret();
  if (!key) return null;
  const payload = b64(JSON.stringify({ s: claim.slug, l: claim.locale, f: claim.format, e: Math.floor(Date.now() / 1000) + ttlSeconds, ...(claim.lead ? { k: claim.lead } : {}) }));
  return `${payload}.${sign(payload, key)}`;
}

/** The file a token is good for, or null when it is forged, malformed or expired. */
export function verifyDownloadToken(token: string | null | undefined): DownloadClaim | null {
  const key = secret();
  if (!key || !token || token.length > 600) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const claim: DownloadClaim = { slug: String(data.s || ""), locale: String(data.l || ""), format: String(data.f || ""), exp: Number(data.e), ...(data.k ? { lead: String(data.k) } : {}) };
    if (!claim.slug || !claim.locale || !claim.format || !Number.isFinite(claim.exp) || claim.exp < Date.now() / 1000) return null;
    return claim;
  } catch {
    return null;
  }
}

/** The address of a download (relative to the site). */
export function downloadHref(slug: string, token: string) {
  return `/api/download/${slug}?t=${encodeURIComponent(token)}`;
}
