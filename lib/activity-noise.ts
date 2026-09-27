/**
 * Activity events that are bookkeeping behind another event (a document row
 * and version being created before it is signed; an email not sent because
 * email isn't set up). They stay in the audit log but are left out of the
 * timelines people read.
 */
export const QUIET_ACTIVITY_EVENT_TYPES = [
  "rental_document_created",
  "rental_document_version_created",
  "rental_document_draft_created",
  "rental_document_pdf_generated",
  "rental_document_email_skipped"
] as const;

export function isQuietActivityEvent(eventType: unknown) {
  return (QUIET_ACTIVITY_EVENT_TYPES as readonly string[]).includes(String(eventType || ""));
}

/** For a Supabase `.not("event_type", "in", ...)` filter. */
export const QUIET_ACTIVITY_EVENT_FILTER = `(${QUIET_ACTIVITY_EVENT_TYPES.join(",")})`;
