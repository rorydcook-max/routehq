/**
 * A save that can't be done comes back from the server as `{ actionError: "the reason" }` instead of being
 * thrown: in production Next.js replaces the text of a thrown error with a generic notice, so the person
 * would only ever see "Couldn't save. Try again." (Rory, 8 Nov 2026: a customer with only a Messenger link
 * couldn't be added and nothing said why). Safe to import in the browser.
 */
export type ActionFailure = { actionError: string };

export function isActionFailure(value: unknown): value is ActionFailure {
  return Boolean(value) && typeof value === "object" && typeof (value as ActionFailure).actionError === "string";
}

/** Waits for a server action and throws its reason as an ordinary error, so a screen's existing `catch` shows it. */
export async function unwrap<T>(pending: Promise<T | ActionFailure>): Promise<T> {
  const result = await pending;
  if (isActionFailure(result)) throw new Error(result.actionError);
  return result as T;
}
