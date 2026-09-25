/**
 * The wording a business accepts when it authorises its electronic signature.
 *
 * The accepted version is stored on the organisation and copied into every
 * agreement's business snapshot, so it is always possible to show which
 * wording applied to a given contract. Never edit the text of an existing
 * version: add a new version instead.
 *
 * v1 covered signatures applied "through authorised users of this RouteHQ
 * account" - i.e. an operator clicking finalise. It did not cover RouteHQ
 * applying the signature automatically when a customer completes an online
 * booking, so automatic countersigning requires v2.
 */

export const SIGNATURE_AUTHORISATION_TEXT_VERSION = "business-signature-authorisation-v2";

export const SIGNATURE_AUTHORISATION_TEXT =
  "I authorise this electronic signature to be applied to rental agreements and related rental documents issued by this business, either by authorised users of this RouteHQ account or automatically by RouteHQ when a customer completes an online booking.";

/** Authorisation versions whose wording covers automatic signing on online bookings. */
export const AUTOMATIC_SIGNING_AUTHORISATION_VERSIONS = new Set<string>(["business-signature-authorisation-v2"]);

export function authorisationCoversAutomaticSigning(version: string | null | undefined) {
  return Boolean(version && AUTOMATIC_SIGNING_AUTHORISATION_VERSIONS.has(version));
}
