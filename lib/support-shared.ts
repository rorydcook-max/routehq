/** Help: the parts the browser may use too (no server imports here). */

export const SUPPORT_TOPICS = ["question", "problem", "import", "billing", "domain", "idea"] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];
/** Topics a business picks from; "domain" is opened from Settings. */
export const PICKABLE_TOPICS: SupportTopic[] = ["question", "problem", "import", "billing", "idea"];
export const SUPPORT_CHANNELS = ["app", "whatsapp", "line", "email"] as const;
export type SupportChannel = (typeof SUPPORT_CHANNELS)[number];

export const SUPPORT_BUCKET = "support-files";
export const SUPPORT_MAX_FILES = 10;
export const SUPPORT_MAX_FILE_MB = 20;
export const SUPPORT_ACCEPT = "image/*,.pdf,.csv,.xls,.xlsx,.ods,.numbers,.doc,.docx,.txt,.ics,.zip";

export type SupportAttachment = { path: string; name: string; size: number; type: string };

/** How the business prefers to hear back, kept in the business settings. */
export function supportPreference(settings: unknown): { channel: SupportChannel; handle: string } {
  const raw = (settings && typeof settings === "object" ? (settings as any).support : null) || {};
  const channel = (SUPPORT_CHANNELS as readonly string[]).includes(raw.channel) ? (raw.channel as SupportChannel) : "app";
  return { channel, handle: String(raw.handle || "") };
}

/** Where the team replies outside RouteHQ, when the business asked for that. */
export function replyLinkFor(channel: SupportChannel, handle: string, text = ""): string | null {
  const value = handle.trim();
  if (!value) return null;
  if (channel === "whatsapp") {
    const digits = value.replace(/\D/g, "").replace(/^0/, "66");
    return digits ? `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}` : null;
  }
  if (channel === "line") return `https://line.me/R/ti/p/${encodeURIComponent(value.startsWith("@") ? value : `~${value}`)}`;
  if (channel === "email") return `mailto:${value}${text ? `?subject=${encodeURIComponent(text)}` : ""}`;
  return null;
}

export function fileSizeLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
