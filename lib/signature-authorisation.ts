/**
 * The wording a business accepts when it authorises its electronic signature.
 *
 * The accepted version is stored on the organisation and copied into every
 * agreement's business snapshot, so it is always possible to show which
 * wording applied to a given contract. Never edit the text of an existing
 * version: add a new version instead.
 *
 * v1 covered signatures applied "through authorised users of this RoveHQ
 * account" - i.e. an operator clicking finalise. It did not cover RoveHQ
 * applying the signature automatically when a customer completes an online
 * booking, so automatic countersigning requires v2.
 *
 * v3 (7 Nov 2026) is v2's wording in US spelling ("authorize", "authorized"), for new signatures only. It covers the
 * same as v2; businesses that accepted v2 keep it.
 */

/** v2's exact wording, kept for the record of what earlier businesses accepted. */
export const SIGNATURE_AUTHORISATION_TEXT_V2 =
  "I authorise this electronic signature to be applied to rental agreements and related rental documents issued by this business, either by authorised users of this RoveHQ account or automatically by RoveHQ when a customer completes an online booking.";

export const SIGNATURE_AUTHORISATION_TEXT_VERSION = "business-signature-authorisation-v3";

export const SIGNATURE_AUTHORISATION_TEXT =
  "I authorize this electronic signature to be applied to rental agreements and related rental documents issued by this business, either by authorized users of this RoveHQ account or automatically by RoveHQ when a customer completes an online booking.";

/** Authorisation versions whose wording covers automatic signing on online bookings. */
export const AUTOMATIC_SIGNING_AUTHORISATION_VERSIONS = new Set<string>(["business-signature-authorisation-v2", "business-signature-authorisation-v3"]);

export function authorisationCoversAutomaticSigning(version: string | null | undefined) {
  return Boolean(version && AUTOMATIC_SIGNING_AUTHORISATION_VERSIONS.has(version));
}
