/** Help: the parts the browser may use too (no server imports here). */

export const SUPPORT_TOPICS = ["question", "problem", "import", "billing", "domain", "idea"] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];
/** Topics a business picks from; "domain" is opened from Settings. */
export const PICKABLE_TOPICS: SupportTopic[] = ["question", "problem", "import", "billing", "idea"];

export const SUPPORT_BUCKET = "support-files";
export const SUPPORT_MAX_FILES = 10;
export const SUPPORT_MAX_FILE_MB = 20;
export const SUPPORT_ACCEPT = "image/*,.pdf,.csv,.xls,.xlsx,.ods,.numbers,.doc,.docx,.txt,.ics,.zip";

export type SupportAttachment = { path: string; name: string; size: number; type: string };

export function fileSizeLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
