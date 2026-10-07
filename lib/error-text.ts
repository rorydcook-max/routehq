/**
 * What to show when a save fails in the browser. In production the framework
 * replaces the text of an error thrown on the server with a long English
 * notice about "Server Components"; nobody should be shown that, so the
 * screen's own plain sentence is used instead.
 */
export function shownError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  return !message || /Server Components render|omitted in production|digest property/i.test(message) ? fallback : message;
}
