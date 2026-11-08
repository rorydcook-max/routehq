import { tellRentalCustomer, type CustomerMessageResult } from "@/lib/customer-messages";
import { recordActivityEvent } from "@/lib/supabase/activity";

/**
 * A handover or return form finished with "Customer not present" (Rory, 8 Nov 2026: "they should be able to, but it
 * should be noted somewhere as an outstanding item and the customer will have a link to sign at some point with
 * notification"). The inspection is saved unsigned with signature_requested_at set; the owner gets a To do
 * ("Customer signature needed: <ref>") that closes once every report on the booking is signed; the customer is sent
 * a link to review the report (photos, odometer, fuel, damage) and sign it on their booking page
 * (app/(app)/book/[token]/report/[inspectionId]). Signing: app/actions/inspection-signing.ts.
 *
 * Takes a service-role client.
 */

export const SIGNATURE_TASK = "inspection_signature";

export type PendingReport = { depositSettlement?: unknown; swap?: boolean };

export function waitingForSignature(inspection: { customer_signature?: unknown; signature_requested_at?: unknown } | null | undefined) {
  return Boolean(inspection?.signature_requested_at) && !String(inspection?.customer_signature || "").trim();
}

/** "VR-0012": the reference the owner knows the booking by. */
export async function bookingRefFor(admin: any, rentalId: string) {
  const { data } = await admin.from("rentals").select("display_code, reference").eq("id", rentalId).maybeSingle();
  return String(data?.display_code || data?.reference || rentalId.slice(0, 8)).toUpperCase();
}

/** The customer's page for signing this report: their booking link plus /report/<inspection>. */
export async function signatureLinkFor(admin: any, rentalId: string, inspectionId: string): Promise<string | null> {
  const { data } = await admin.from("booking_links").select("token, public_url").eq("rental_id", rentalId).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data?.token) return null;
  const base = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const page = base ? `${base}/book/${data.token}` : String(data.public_url || "").replace(/\/$/, "");
  return page ? `${page}/report/${inspectionId}` : null;
}

/**
 * Sends the customer the link to sign, and (the first time) puts the job on the owner's To do and the booking's
 * history. Again later ("Resend signature link"): the message only, noted on the history. Never throws.
 */
export async function requestInspectionSignature(
  admin: any,
  args: { organizationId: string; rentalId: string; vehicleId: string; inspectionId: string; mode: "delivery" | "return"; userId: string | null; resend?: boolean }
): Promise<CustomerMessageResult> {
  const now = new Date().toISOString();
  const ref = await bookingRefFor(admin, args.rentalId).catch(() => args.rentalId.slice(0, 8).toUpperCase());
  if (!args.resend) {
    const { data: open } = await admin.from("tasks").select("id").eq("organization_id", args.organizationId).eq("rental_id", args.rentalId).eq("action", SIGNATURE_TASK).is("completed_at", null).is("deleted_at", null).limit(1);
    if (!open?.length) {
      await admin
        .from("tasks")
        .insert({
          organization_id: args.organizationId,
          vehicle_id: args.vehicleId,
          rental_id: args.rentalId,
          title_key: null,
          created_by: args.userId,
          title: `Customer signature needed: ${ref}`,
          task_type: "admin",
          action: SIGNATURE_TASK,
          due_at: now
        })
        .then(() => null, () => null);
    }
  }
  await admin.from("inspections").update({ signature_requested_at: now }).eq("id", args.inspectionId).eq("organization_id", args.organizationId).then(() => null, () => null);

  const link = await signatureLinkFor(admin, args.rentalId, args.inspectionId).catch(() => null);
  // No booking link (a booking never sent to the customer): there is no page to sign on, so nothing is sent.
  const result: CustomerMessageResult = link
    ? await tellRentalCustomer(
        admin,
        args.rentalId,
        ({ say, vehicle }) => say(args.mode === "return" ? "signReturnReport" : "signHandoverReport", { vehicle, link }),
        { sentBy: args.userId, withLink: false, metadata: { inspection_signature: args.inspectionId } }
      )
    : { sent: false, reason: "no_customer" };

  const report = args.mode === "return" ? "return report" : "handover report";
  const how = result.sent
    ? `sent by ${result.via}.`
    : !link
      ? "not sent, the booking has no customer link."
      : result.reason === "no_chat"
        ? "ready to send from the booking's messages."
        : "not sent, customer messages are off.";
  await recordActivityEvent(admin, {
    organization_id: args.organizationId,
    actor_id: args.userId,
    entity_type: "inspection",
    entity_id: args.inspectionId,
    vehicle_id: args.vehicleId,
    rental_id: args.rentalId,
    event_type: args.resend ? "inspection_signature_resent" : "inspection_signature_requested",
    title: args.resend ? "Signature link sent again" : "Waiting for customer signature",
    detail: `${args.resend ? "" : "Customer not present. "}Link to sign the ${report}: ${how}`
  } as any).catch(() => null);
  return result;
}

/** Closes "Customer signature needed" once no report on the booking is waiting for the customer. */
export async function closeSignatureTaskIfDone(admin: any, organizationId: string, rentalId: string) {
  const { data: waiting } = await admin
    .from("inspections")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("rental_id", rentalId)
    .not("signature_requested_at", "is", null)
    .is("customer_signature", null)
    .is("deleted_at", null)
    .limit(1);
  if (waiting?.length) return;
  await admin
    .from("tasks")
    .update({ completed_at: new Date().toISOString(), completion_notes: "Signed by the customer" })
    .eq("organization_id", organizationId)
    .eq("rental_id", rentalId)
    .eq("action", SIGNATURE_TASK)
    .is("completed_at", null)
    .then(() => null, () => null);
}
