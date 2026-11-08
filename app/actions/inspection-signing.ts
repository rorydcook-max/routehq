"use server";

import { revalidatePath } from "next/cache";
import { guard } from "@/lib/action-error";
import { said } from "@/lib/i18n/server-text";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth/roles";
import { adoptBusinessClock } from "@/lib/auth/active-organization-server";
import { enterBusinessTimeZone } from "@/lib/business-time-scope";
import { finaliseInspectionReport, type DepositSettlement } from "@/lib/inspection-report";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { notifyOperator } from "@/lib/notify-operator";
import { closeSignatureTaskIfDone, requestInspectionSignature, waitingForSignature, type PendingReport } from "@/lib/inspection-signature";

/**
 * The customer signs a handover or return report they weren't there to sign (lib/inspection-signature.ts), from
 * their booking link. The link's token is the only key: the report must belong to that link's booking.
 */
export async function signInspectionReport(input: { token: string; inspectionId: string; signerName: string; signatureDataUrl: string; accepted: boolean }): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = createSupabaseAdminClient() as any;
    const token = String(input.token || "").trim();
    const inspectionId = String(input.inspectionId || "").trim();
    if (!token || !/^[0-9a-f-]{36}$/i.test(inspectionId)) return { ok: false, error: await said("This report can't be found.") };
    const { data: link } = await admin.from("booking_links").select("organization_id, rental_id").eq("token", token).is("deleted_at", null).maybeSingle();
    if (!link?.rental_id) return { ok: false, error: await said("This report can't be found.") };
    const { data: inspection } = await admin
      .from("inspections")
      .select("*")
      .eq("id", inspectionId)
      .eq("organization_id", link.organization_id)
      .eq("rental_id", link.rental_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!inspection) return { ok: false, error: await said("This report can't be found.") };
    // Signed already (a second tap, another device): nothing to do.
    if (!waitingForSignature(inspection)) return { ok: true };

    const name = String(input.signerName || "").trim().slice(0, 120);
    const signature = String(input.signatureDataUrl || "");
    if (!input.accepted) return { ok: false, error: await said("Tick the box to confirm the report.") };
    if (name.length < 2) return { ok: false, error: await said("Type your full name.") };
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature) || signature.length > 380_000) return { ok: false, error: await said("Sign in the box.") };

    enterBusinessTimeZone(await adoptBusinessClock(admin, link.organization_id));
    const now = new Date().toISOString();
    const { data: updated, error } = await admin
      .from("inspections")
      .update({ customer_signature: signature, customer_signed_at: now, customer_signed_name: name })
      .eq("id", inspectionId)
      .is("customer_signature", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) return { ok: true };

    const mode = (inspection.type || inspection.inspection_type) === "return" ? "return" : "delivery";
    const pending = (inspection.pending_report || {}) as PendingReport;
    // The report as it would have been made at the form, now with the signature and the day it was signed.
    await finaliseInspectionReport({
      supabase: admin,
      remote: true,
      organizationId: link.organization_id,
      inspectionId,
      rentalId: link.rental_id,
      vehicleId: inspection.vehicle_id,
      customerId: inspection.customer_id,
      mode,
      inspectedAt: inspection.submitted_at || inspection.inspected_at || now,
      odometerReading: Number(inspection.odometer_reading ?? inspection.mileage ?? 0),
      fuelLevel: inspection.fuel_level ?? null,
      fuelLevelLabel: inspection.fuel_level_label || null,
      damageItems: Array.isArray(inspection.damage_items) ? inspection.damage_items : [],
      notes: inspection.notes || null,
      customerSignature: signature,
      customerSignedName: name,
      depositSettlement: (pending.depositSettlement as DepositSettlement | null) || null,
      swap: Boolean(pending.swap),
      photos: Array.isArray(inspection.photos) ? inspection.photos : [],
      signedAt: now
    });
    await admin.from("inspections").update({ pending_report: null }).eq("id", inspectionId);
    await closeSignatureTaskIfDone(admin, link.organization_id, link.rental_id);

    const [{ data: rental }, { data: vehicle }] = await Promise.all([
      admin.from("rentals").select("customer_id, customers!rentals_customer_id_fkey(full_name)").eq("id", link.rental_id).maybeSingle(),
      admin.from("vehicles").select("make, model, registration_number").eq("id", inspection.vehicle_id).maybeSingle()
    ]);
    const vehicleLabel = [vehicle?.registration_number, vehicle?.make, vehicle?.model].filter(Boolean).join(" ");
    const report = mode === "return" ? "return report" : "handover report";
    await recordActivityEvent(admin, {
      organization_id: link.organization_id,
      entity_type: "inspection",
      entity_id: inspectionId,
      vehicle_id: inspection.vehicle_id,
      rental_id: link.rental_id,
      customer_id: rental?.customer_id || inspection.customer_id || null,
      event_type: "inspection_signed_by_customer",
      title: `Customer signed the ${report}`,
      detail: `${name} signed the ${report} from their booking link.`
    } as any).catch(() => null);
    await notifyOperator(
      link.organization_id,
      { emoji: "✍️", key: mode === "return" ? "returnReportSigned" : "handoverReportSigned", values: { customer: name, vehicle: vehicleLabel || null } },
      "contract_signed",
      `/bookings/${link.rental_id}`
    ).catch(() => null);
    revalidatePath(`/bookings/${link.rental_id}`);
    revalidatePath("/tasks");
    return { ok: true };
  } catch (error) {
    console.error("inspection signing failed", error);
    return { ok: false, error: await said("That didn't go through. Try again.") };
  }
}

/** "Resend signature link" on the booking page: the customer is sent the link again. */
export async function resendInspectionSignatureLink(inspectionId: string) {
  return guard(async () => {
    const membership = await getCurrentMembership();
    // guard() puts these sentences into the reader's language (lib/action-error.ts).
    if (!membership?.organizationId) throw new Error("Please sign in again.");
    const admin = createSupabaseAdminClient() as any;
    const { data: inspection } = await admin
      .from("inspections")
      .select("id, rental_id, vehicle_id, type, inspection_type, customer_signature, signature_requested_at")
      .eq("id", inspectionId)
      .eq("organization_id", membership.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!inspection?.rental_id || !waitingForSignature(inspection)) throw new Error("This report has already been signed.");
    const result = await requestInspectionSignature(admin, {
      organizationId: membership.organizationId,
      rentalId: inspection.rental_id,
      vehicleId: inspection.vehicle_id,
      inspectionId: inspection.id,
      mode: (inspection.type || inspection.inspection_type) === "return" ? "return" : "delivery",
      userId: membership.userId || null,
      resend: true
    });
    revalidatePath(`/bookings/${inspection.rental_id}`);
    return { sent: result.sent };
  });
}
