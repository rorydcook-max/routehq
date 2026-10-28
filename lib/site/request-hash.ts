import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * The visitor's address as a salted hash, for rate-limiting the website's forms (contact, free downloads) without
 * keeping the address itself.
 */
export async function requestIpHash() {
  const list = await headers();
  const ip = list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "unknown";
  const salt = process.env.CONTACT_IP_SALT || "routehq-contact-v1";
  return createHash("sha256").update(`${ip}|${salt}`).digest("hex");
}

/** A form field as trimmed text, cut to a maximum length. */
export function formText(formData: FormData, key: string, max: number) {
  return String(formData.get(key) || "")
    .trim()
    .slice(0, max);
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
