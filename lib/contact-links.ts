/**
 * How a customer can be reached, and the link that opens each way. Shared by the booking page's
 * Customer section and the message panel. Safe to import on the server and in the browser.
 */

export type ContactKey = "whatsapp" | "messenger" | "line" | "telegram" | "phone" | "email" | "instagram";

export type ContactChannel = { key: ContactKey; label: string; handle: string; url: string | null };

type ContactFields = {
  phone?: string | null;
  email?: string | null;
  whatsapp_number?: string | null;
  messenger_id?: string | null;
  line_id?: string | null;
  telegram_username?: string | null;
  instagram_handle?: string | null;
};

const LABELS: Record<ContactKey, string> = {
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  line: "LINE",
  telegram: "Telegram",
  phone: "Phone",
  email: "Email",
  instagram: "Instagram"
};

/** Every way of reaching the customer that has been recorded, in the order the message panel shows them. */
export function contactChannels(customer: ContactFields | null | undefined): ContactChannel[] {
  if (!customer) return [];
  const pairs: Array<[ContactKey, string | null | undefined]> = [
    ["whatsapp", customer.whatsapp_number],
    ["messenger", customer.messenger_id],
    ["line", customer.line_id],
    ["telegram", customer.telegram_username],
    ["phone", customer.phone],
    ["email", customer.email],
    ["instagram", customer.instagram_handle]
  ];
  return pairs
    .filter(([, handle]) => String(handle || "").trim())
    .map(([key, handle]) => ({ key, label: LABELS[key], handle: String(handle).trim(), url: contactUrl(key, String(handle).trim()) }));
}

export function contactUrl(key: ContactKey | string, handle: string): string | null {
  if (key === "whatsapp") return `https://wa.me/${handle.replace(/\D/g, "")}`;
  if (key === "messenger") return messengerUrl(handle);
  if (key === "telegram") return `https://t.me/${cleanHandle(handle)}`;
  if (key === "phone") return `tel:${handle}`;
  if (key === "email") return `mailto:${handle}`;
  if (key === "instagram") return `https://instagram.com/${cleanHandle(handle)}`;
  if (key === "line") return `https://line.me/ti/p/${encodeURIComponent(handle)}`;
  return null;
}

/**
 * Messenger may be saved as a pasted link (facebook.com/name, facebook.com/profile.php?id=…, messenger.com/t/…,
 * m.me/…) or just as the person's name. A link or username opens the chat; a plain name (with spaces) opens
 * Messenger, where the operator finds them by that name.
 */
export function messengerUrl(value: string) {
  const text = value.trim();
  const id = text.match(/[?&]id=(\d+)/)?.[1];
  if (id) return `https://m.me/${id}`;
  // A chat link copied from Messenger (facebook.com/messages/t/1000…, messenger.com/t/name): the person is after /t/.
  // It used to open m.me/messages, which is nobody (real-user-test, 8 Nov 2026).
  const chat = text.match(/(?:facebook\.com|fb\.com|messenger\.com)\/(?:messages\/)?t\/([^/?#\s]+)/i)?.[1];
  if (chat) return `https://m.me/${chat}`;
  // facebook.com/people/Their-Name/1000…: the number at the end is the person.
  const person = text.match(/facebook\.com\/people\/[^/?#\s]+\/(\d+)/i)?.[1];
  if (person) return `https://m.me/${person}`;
  const path = text.match(/(?:facebook\.com|fb\.com|m\.me)\/([^/?#\s]+)/i)?.[1];
  if (path && !["profile.php", "messages", "people"].includes(path.toLowerCase())) return `https://m.me/${path}`;
  if (/^[A-Za-z0-9.]{3,}$/.test(text)) return `https://m.me/${text}`;
  return "https://www.messenger.com/";
}

export function cleanHandle(value: string) {
  return value.replace(/^https?:\/\/(www\.)?/i, "").replace(/^m\.me\//i, "").replace(/^t\.me\//i, "").replace(/^instagram\.com\//i, "").replace(/^@/, "").trim();
}
