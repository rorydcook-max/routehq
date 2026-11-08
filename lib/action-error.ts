import { unstable_rethrow } from "next/navigation";
import { said } from "@/lib/i18n/server-text";
import type { ActionFailure } from "@/lib/action-result";

/**
 * The reason a save failed, as one plain sentence the person can act on, in their language.
 * Sentences written for people ("Another vehicle already has this plate number.") pass through;
 * database and framework wording never reaches the screen, the screen's own sentence is used instead.
 */

const KNOWN: Array<[RegExp, string]> = [
  [/vehicles_live_plate_key/i, "Another vehicle already has this plate number."],
  [/branches_organization_id_name_key/i, "You already have a location with this name."],
  [/organizations_booking_subdomain_key|organizations_slug_key/i, "That name is already taken. Try another."],
  [/organizations_custom_domain_key/i, "That domain is already used by another business."],
  [/rentals_org_reference_unique/i, "That booking reference is already used. Try again."],
  [/(payload|entity|body) (is )?too large|exceeded the maximum|Body exceeded/i, "That file is too big. Try a smaller one."],
  [/JWT expired|invalid JWT|Auth session missing|^You must be signed in/i, "Please sign in again."],
  [/row-level security|permission denied/i, "Your account can't change this. Ask the business owner."],
  [/invalid input syntax for type (numeric|integer|bigint|double)/i, "Check the numbers: use digits only, like 1500 or 12.5."],
  [/invalid input syntax for type date|date\/time field value out of range/i, "Check the dates."],
  [/fetch failed|ECONNRESET|ETIMEDOUT|NetworkError/i, "The connection dropped. Check your internet and try again."]
];

const TECHNICAL =
  /duplicate key|violates|null value in column|invalid input|syntax error|does not exist|PGRST|Server Components|digest|Minified React|Cannot read prop|is not a function|is not defined|Unexpected token|undefined|NaN|\bstorage\b|bucket|schema cache|relation |column |constraint|\bSQL\b|TypeError|ReferenceError|^[a-z]+[A-Z]\w* is required\.$/;

export function friendlyReason(message: string): string | null {
  const text = String(message || "").trim();
  if (!text) return null;
  for (const [test, sentence] of KNOWN) if (test.test(text)) return sentence;
  return TECHNICAL.test(text) ? null : text;
}

export async function userError(error: unknown, fallback = "That couldn't be saved. Nothing was changed."): Promise<string> {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return said(friendlyReason(message) || fallback);
}

/**
 * Runs a server action and hands a failure back as `{ actionError }` (lib/action-result.ts) instead of throwing it,
 * so the screen can say why. Redirects and not-found still work as usual.
 */
export async function guard<T>(run: () => Promise<T>, fallback?: string): Promise<T | ActionFailure> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error);
    console.warn("[action]", error instanceof Error ? error.message : error);
    return { actionError: await userError(error, fallback) };
  }
}
