/**
 * Which chat app to name first. LINE is the everyday app in Thailand, Japan and Taiwan; everywhere else WhatsApp
 * (coming soon) and Telegram are named first, so LINE never reads as the default channel for everyone.
 */
const LINE_COUNTRIES = new Set(["TH", "JP", "TW"]);

export function lineFirst(country: unknown): boolean {
  return LINE_COUNTRIES.has(String(country || "").trim().toUpperCase());
}
