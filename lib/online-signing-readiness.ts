import { buildBusinessDocumentSnapshot, type BusinessDocumentSnapshotOrganization } from "@/lib/business-document-snapshot";
import { authorisationCoversAutomaticSigning } from "@/lib/signature-authorisation";

/**
 * What the business still has to set up before customers can sign online.
 *
 * When a customer completes a booking link, the business's side of the
 * agreement is signed automatically with the signature it authorised in
 * Settings. Without these, the customer reaches the last step and is told the
 * agreement "could not be prepared". Empty list = ready.
 */
export function onlineSigningGaps(organization: BusinessDocumentSnapshotOrganization): string[] {
  const snapshot = buildBusinessDocumentSnapshot(organization);
  const gaps: string[] = [];
  if (!snapshot.authorised_signatory.name) gaps.push("the authorised signatory's name");
  if (!snapshot.authorised_signatory.title) gaps.push("their job title");
  if (snapshot.authorised_signature?.kind !== "storage") gaps.push("an uploaded signature");
  if (!authorisationCoversAutomaticSigning(snapshot.authorised_signatory.signature_authorisation_text_version)) {
    gaps.push("accepting the current signature authorisation (re-upload the signature to accept it)");
  }
  return gaps;
}
