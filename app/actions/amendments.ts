"use server";

import { said } from "@/lib/i18n/server-text";
import { customerMessageText } from "@/lib/i18n/customer-message-text";
import { rentalRateCard, type Rates } from "@/lib/rental-estimate";
import { tryAutoExtend } from "@/lib/auto-extension";
import { getCurrentMembership } from "@/lib/auth/roles";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { buildBusinessDocumentSnapshot } from "@/lib/business-document-snapshot";
import { businessToday, toWallTime } from "@/lib/business-time";
import { htmlToPdf } from "@/lib/html-to-pdf";
import { onlineSigningGaps } from "@/lib/online-signing-readiness";
import { loadBusyPeriods, vehicleConflictMessage } from "@/lib/rental-conflicts";
import { bookingRules, clashes } from "@/lib/booking-rules";
import { moveBookingToVehicle } from "@/lib/extension-picture";
import { syncVehicleStatusFromBookings } from "@/lib/vehicle-status";
import { notifyOperator } from "@/lib/notify-operator";
import {
  amendmentHash,
  amendmentMoney,
  amendmentDate,
  hashFragment,
  renderAmendmentHtml,
  withAmendmentSignatures,
  type AmendmentChanges,
  type AmendmentRenderInput
} from "@/lib/rental-amendments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { formatReportTime } from "@/lib/inspection-report";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function cleanDate(value: unknown) {
  const text = String(value || "").slice(0, 10);
  return ISO_DATE.test(text) ? text : null;
}

function cleanAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Something went wrong.");
}

function vehicleLabel(vehicle: any) {
  const title = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ");
  return [title, vehicle?.registration_number].filter(Boolean).join(" - ") || "Vehicle";
}

function rentalReference(rental: any) {
  return String(rental?.reference || rental?.display_code || String(rental?.id || "").slice(0, 8)).toUpperCase();
}

/** The staff member and their access to the rental's business. */
async function operatorFor(rentalId: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const { data: rental } = await supabase.from("rentals").select("id, organization_id").eq("id", rentalId).is("deleted_at", null).maybeSingle();
  if (!rental) throw new Error("Rental was not found.");
  const { data: membership } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", rental.organization_id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!membership) throw new Error("You do not have access to this rental.");
  return { user, organizationId: rental.organization_id as string };
}

async function loadRental(admin: any, organizationId: string, rentalId: string) {
  const [{ data: organization }, { data: rental }] = await Promise.all([
    admin.from("organizations").select("*").eq("id", organizationId).is("deleted_at", null).maybeSingle(),
    admin.from("rentals").select("*").eq("id", rentalId).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle()
  ]);
  if (!organization || !rental) throw new Error("Rental was not found.");
  const [{ data: vehicle }, { data: customer }, { data: agreement }] = await Promise.all([
    rental.vehicle_id ? admin.from("vehicles").select("*").eq("id", rental.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    rental.customer_id ? admin.from("customers").select("*").eq("id", rental.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    admin
      .from("rental_documents")
      .select("id, current_version_id, status")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .eq("document_type", "rental_agreement")
      .not("status", "in", "(voided,superseded)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  let signedAgreement: { versionNumber: number; signedOn: string | null; hashFragment: string } | null = null;
  if (agreement?.current_version_id) {
    const [{ data: version }, { data: renterSignature }] = await Promise.all([
      admin.from("rental_document_versions").select("version_number, content_hash").eq("id", agreement.current_version_id).maybeSingle(),
      admin
        .from("rental_document_signatures")
        .select("signed_at")
        .eq("document_version_id", agreement.current_version_id)
        .eq("signer_role", "renter")
        .limit(1)
        .maybeSingle()
    ]);
    if (version && renterSignature) {
      signedAgreement = {
        versionNumber: Number(version.version_number || 1),
        signedOn: toWallTime(renterSignature.signed_at).slice(0, 10) || null,
        hashFragment: hashFragment(version.content_hash)
      };
    }
  }
  return { organization, rental, vehicle, customer, signedAgreement };
}

function amendmentSummary(amendment: any) {
  return {
    id: amendment.id as string,
    token: amendment.token as string,
    status: amendment.status as string,
    createdAt: amendment.created_at as string,
    expiresAt: amendment.expires_at as string,
    signedAt: (amendment.signed_at as string) || null,
    changes: amendment.changes as AmendmentChanges
  };
}

export type AmendmentSummary = ReturnType<typeof amendmentSummary>;

/** What the adjust/amend dialog needs to know about a rental. */
export async function getRentalAmendmentContext(rentalId: string): Promise<
  Result<{
    agreementSigned: boolean;
    signingGaps: string[];
    pending: AmendmentSummary | null;
    currentRate: number;
    currentDeposit: number;
    currency: string;
    billingPeriod: string;
    endDate: string | null;
    isIndefinite: boolean;
    /** The vehicle is out with the customer. */
    onRent: boolean;
    /** Rates for pricing extra days (the vehicle's, with this rental's own agreed rate). */
    rates: Rates;
  }>
> {
  try {
    const { organizationId } = await operatorFor(rentalId);
    const admin = createSupabaseAdminClient() as any;
    const { organization, rental, signedAgreement } = await loadRental(admin, organizationId, rentalId);
    const { data: pending } = await admin
      .from("rental_amendments")
      .select("*")
      .eq("rental_id", rentalId)
      .eq("status", "awaiting_signature")
      .maybeSingle();
    const { data: vehicleRates } = rental.vehicle_id
      ? await admin.from("vehicles").select("daily_rate, weekly_rate, monthly_rate").eq("id", rental.vehicle_id).maybeSingle()
      : { data: null };
    return {
      ok: true,
      agreementSigned: Boolean(signedAgreement),
      signingGaps: onlineSigningGaps(organization),
      pending: pending ? amendmentSummary(pending) : null,
      currentRate: Number(rental.rental_rate || 0),
      currentDeposit: Number(rental.deposit_amount || 0),
      currency: String(rental.currency || "THB"),
      billingPeriod: String(rental.billing_interval || rental.pricing_model || "monthly"),
      endDate: cleanDate(rental.end_date),
      isIndefinite: Boolean(rental.is_indefinite),
      onRent: ["active", "due_soon", "overdue", "extended"].includes(String(rental.status)),
      rates: rentalRateCard(vehicleRates, rental)
    };
  } catch (error) {
    return { ok: false, error: await said(errorMessage(error)) };
  }
}

function renderInput(ctx: Awaited<ReturnType<typeof loadRental>>, snapshot: ReturnType<typeof buildBusinessDocumentSnapshot>, changes: AmendmentChanges, preparedOn: string): AmendmentRenderInput {
  return {
    changes,
    businessLegalName: snapshot.legal_name,
    businessTradingName: snapshot.trading_name,
    businessAddress: snapshot.address,
    signatoryName: String(snapshot.authorised_signatory.name || ""),
    signatoryTitle: snapshot.authorised_signatory.title,
    renterName: String(ctx.customer?.full_name || "Renter"),
    vehicleLabel: vehicleLabel(ctx.vehicle),
    rentalReference: rentalReference(ctx.rental),
    agreement: ctx.signedAgreement,
    preparedOn
  };
}

/**
 * Prepare an amendment for the customer to sign. Nothing about the rental
 * changes until they sign it.
 */
export async function createRentalAmendment(input: {
  rentalId: string;
  newEndDate?: string | null;
  extensionAmount?: number | string | null;
  extensionDueDate?: string | null;
  newRate?: number | string | null;
  rateFrom?: string | null;
  newDeposit?: number | string | null;
  depositDueDate?: string | null;
  additionalTerms?: string | null;
}): Promise<Result<{ token: string }>> {
  try {
    const rentalId = String(input.rentalId || "").trim();
    const { user, organizationId } = await operatorFor(rentalId);
    const admin = createSupabaseAdminClient() as any;
    const ctx = await loadRental(admin, organizationId, rentalId);
    const { organization, rental } = ctx;
    const today = businessToday();

    if (["completed", "cancelled"].includes(String(rental.status))) {
      return { ok: false, error: await said("This rental has ended, so its agreement can't be amended.") };
    }
    if (!ctx.signedAgreement) {
      return { ok: false, error: await said("The customer hasn't signed the rental agreement yet. Edit the booking instead - they will sign the updated terms.") };
    }
    if (!ctx.customer) return { ok: false, error: await said("Assign a customer to this rental first.") };
    const gaps = onlineSigningGaps(organization);
    if (gaps.length) {
      return { ok: false, error: await said(`Customers can't sign online until your business adds ${gaps.join(", ")} in Settings.`) };
    }

    const currency = String(rental.currency || "THB");
    const changes: AmendmentChanges = { currency, billing_period: String(rental.billing_interval || rental.pricing_model || "monthly") };
    const previousEnd = cleanDate(rental.end_date);

    const newEndDate = cleanDate(input.newEndDate);
    if (newEndDate) {
      if (rental.is_indefinite) return { ok: false, error: await said("This rental is open-ended, so it has no return date to extend.") };
      if (previousEnd && newEndDate <= previousEnd) return { ok: false, error: await said("The new return date must be after the current one.") };
      if (rental.vehicle_id && rental.start_date) {
        const conflict = await vehicleConflictMessage(admin, {
          organizationId,
          vehicleId: rental.vehicle_id,
          startDate: String(rental.start_date).slice(0, 10),
          endDate: newEndDate,
          excludeRentalId: rental.id
        });
        if (conflict) {
          return { ok: false, error: await said(`Can't extend to that date. ${conflict.replace(/ Choose other dates or another vehicle\.$/, "")}`) };
        }
      }
      changes.previous_end_date = previousEnd;
      changes.new_end_date = newEndDate;
      const amount = cleanAmount(input.extensionAmount);
      if (amount && amount > 0) {
        changes.extension_amount = amount;
        changes.extension_due_date = cleanDate(input.extensionDueDate) || previousEnd || today;
      }
    }

    const newRate = cleanAmount(input.newRate);
    const currentRate = Number(rental.rental_rate || 0);
    if (newRate !== null && newRate !== currentRate) {
      if (newRate <= 0) return { ok: false, error: await said("Enter a rate above zero.") };
      changes.previous_rate = currentRate;
      changes.new_rate = newRate;
      changes.rate_from = cleanDate(input.rateFrom) || today;
    }

    const newDeposit = cleanAmount(input.newDeposit);
    const currentDeposit = Number(rental.deposit_amount || 0);
    if (newDeposit !== null && newDeposit !== currentDeposit) {
      changes.previous_deposit = currentDeposit;
      changes.new_deposit = newDeposit;
      if (newDeposit > currentDeposit) changes.deposit_due_date = cleanDate(input.depositDueDate) || today;
    }

    const terms = String(input.additionalTerms || "").trim().slice(0, 2000);
    if (terms) changes.additional_terms = terms;

    if (!changes.new_end_date && changes.new_rate === undefined && changes.new_deposit === undefined) {
      return { ok: false, error: await said("Nothing to change: set a new return date, rate or deposit.") };
    }

    const snapshot = buildBusinessDocumentSnapshot(organization);
    const html = renderAmendmentHtml(renderInput(ctx, snapshot, changes, today));
    const { data: amendment, error } = await admin
      .from("rental_amendments")
      .insert({
        organization_id: organizationId,
        rental_id: rentalId,
        changes,
        rendered_html: html,
        content_hash: amendmentHash(html),
        business_snapshot: snapshot,
        created_by: user.id
      })
      .select("*")
      .single();
    if (error) {
      if (String(error.code) === "23505") {
        return { ok: false, error: await said("This rental already has an amendment waiting for the customer. Cancel it first to prepare a different one.") };
      }
      throw new Error(error.message);
    }

    await recordActivityEvent(admin, {
      organization_id: organizationId,
      actor_id: user.id,
      entity_type: "rental",
      entity_id: rentalId,
      vehicle_id: rental.vehicle_id,
      rental_id: rentalId,
      customer_id: rental.customer_id,
      event_type: "rental_amendment_created",
      title: "Amendment sent for signature",
      detail: describeChanges(changes),
      metadata: { amendment_id: amendment.id }
    });
    revalidatePath(`/bookings/${rentalId}`);
    return { ok: true, token: amendment.token };
  } catch (error) {
    return { ok: false, error: await said(errorMessage(error)) };
  }
}

function describeChanges(changes: AmendmentChanges) {
  const parts: string[] = [];
  if (changes.new_vehicle_id) parts.push(`Vehicle ${changes.previous_vehicle_label || "current"} to ${changes.new_vehicle_label || "replacement"}`);
  if (changes.new_end_date) {
    parts.push(
      `Return date ${amendmentDate(changes.previous_end_date)} to ${amendmentDate(changes.new_end_date)}` +
        (changes.extension_amount ? ` for ${amendmentMoney(changes.extension_amount, changes.currency)}` : "")
    );
  }
  if (changes.new_rate !== undefined && changes.new_rate !== null) {
    parts.push(`Rate ${amendmentMoney(changes.previous_rate, changes.currency)} to ${amendmentMoney(changes.new_rate, changes.currency)} from ${amendmentDate(changes.rate_from)}`);
  }
  if (changes.new_deposit !== undefined && changes.new_deposit !== null) {
    parts.push(`Deposit ${amendmentMoney(changes.previous_deposit, changes.currency)} to ${amendmentMoney(changes.new_deposit, changes.currency)}`);
  }
  return parts.join(". ") + ".";
}

export async function cancelRentalAmendment(amendmentId: string): Promise<Result> {
  try {
    const admin = createSupabaseAdminClient() as any;
    const { data: amendment } = await admin.from("rental_amendments").select("*").eq("id", amendmentId).maybeSingle();
    if (!amendment) return { ok: false, error: await said("Amendment was not found.") };
    const { user } = await operatorFor(amendment.rental_id);
    if (amendment.status !== "awaiting_signature") return { ok: false, error: await said("Only an amendment waiting for a signature can be cancelled.") };
    if (amendment.changes?.applied_before_signature) {
      return { ok: false, error: await said("The vehicle has already been changed, so this still needs the customer's signature. To undo it, change the vehicle back.") };
    }
    const { error } = await admin
      .from("rental_amendments")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: user.id })
      .eq("id", amendmentId)
      .eq("status", "awaiting_signature");
    if (error) throw new Error(error.message);
    if (amendment.changes?.swap_group && amendment.changes?.swap_with_rental_id) {
      // An exchange needs both customers: cancelling one side cancels the other.
      await admin
        .from("rental_amendments")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: user.id })
        .eq("rental_id", amendment.changes.swap_with_rental_id)
        .eq("changes->>swap_group", String(amendment.changes.swap_group))
        .eq("status", "awaiting_signature");
      revalidatePath(`/bookings/${amendment.changes.swap_with_rental_id}`);
    }
    await recordActivityEvent(admin, {
      organization_id: amendment.organization_id,
      actor_id: user.id,
      entity_type: "rental",
      entity_id: amendment.rental_id,
      rental_id: amendment.rental_id,
      event_type: "rental_amendment_cancelled",
      title: "Amendment cancelled",
      detail: `The amendment sent for signature was cancelled before the customer signed. ${describeChanges(amendment.changes)}`,
      metadata: { amendment_id: amendment.id }
    });
    revalidatePath(`/bookings/${amendment.rental_id}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: await said(errorMessage(error)) };
  }
}

function parseSignaturePng(dataUrl: string) {
  const match = String(dataUrl || "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Please sign in the box before submitting.");
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length < 32 || buffer.length > 280_000) throw new Error("The signature image size is invalid.");
  if (!buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error("The signature is not a valid image.");
  }
  return buffer;
}

async function requestMeta() {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for") || "";
  return {
    ip: forwarded.split(",")[0]?.trim() || list.get("x-real-ip") || null,
    userAgent: list.get("user-agent") || null
  };
}

/**
 * The customer signs an amendment. The signed copy becomes an immutable
 * rental document carrying the business's pre-authorised signature and the
 * customer's, and then the changes are applied to the rental.
 */
export async function signRentalAmendment(input: {
  token: string;
  signerName: string;
  signatureDataUrl: string;
  contentHash: string;
  accepted: boolean;
}): Promise<Result> {
  const admin = createSupabaseAdminClient() as any;
  const storage = admin.storage.from("documents");
  const uploaded: string[] = [];
  try {
    const token = String(input.token || "").trim();
    if (!input.accepted) return { ok: false, error: await said("Please confirm that you agree to the changes.") };
    const { data: amendment } = await admin.from("rental_amendments").select("*").eq("token", token).maybeSingle();
    if (!amendment) return { ok: false, error: await said("This amendment could not be found.") };
    if (amendment.status === "signed") return { ok: true };
    if (amendment.status !== "awaiting_signature") return { ok: false, error: await said("This amendment was cancelled by the rental business.") };
    if (new Date(amendment.expires_at).getTime() < Date.now()) return { ok: false, error: await said("This amendment has expired. Please ask the rental business for a new link.") };
    if (input.contentHash !== amendment.content_hash) {
      return { ok: false, error: await said("The amendment has changed since you opened it. Please reload the page.") };
    }

    const { data: customer } = await admin
      .from("rentals")
      .select("customer_id, customers(full_name)")
      .eq("id", amendment.rental_id)
      .maybeSingle();
    const signerName = String(input.signerName || "").trim().slice(0, 120);
    const customerName = String(customer?.customers?.full_name || "").trim();
    if (!signerName) return { ok: false, error: await said("Please type your full name.") };
    if (customerName && !signerName.toLowerCase().includes(customerName.split(/\s+/)[0].toLowerCase())) {
      return { ok: false, error: await said(`Please sign with your name as it appears on the rental (${customerName}).`) };
    }
    const png = parseSignaturePng(input.signatureDataUrl);

    const documentId = randomUUID();
    const versionId = randomUUID();
    const prefix = `organizations/${amendment.organization_id}/rentals/${amendment.rental_id}/rental-documents/${documentId}/versions/${versionId}`;
    const signaturePath = `${prefix}/signatures/renter-${randomUUID()}.png`;
    const pdfPath = `${prefix}/final/amendment.pdf`;

    const businessSignature = amendment.business_snapshot?.authorised_signature;
    let businessSignatureUrl: string | null = null;
    if (businessSignature?.kind === "storage" && businessSignature.bucket && businessSignature.path) {
      const { data } = await admin.storage.from(businessSignature.bucket).createSignedUrl(businessSignature.path, 10 * 60);
      businessSignatureUrl = data?.signedUrl || null;
    }
    const signedAtLabel = formatReportTime(new Date().toISOString());
    const pdf = await htmlToPdf(
      withAmendmentSignatures(amendment.rendered_html, {
        businessSignatureUrl,
        renterSignatureDataUrl: String(input.signatureDataUrl),
        renterName: signerName,
        signedAtLabel
      })
    );

    const sigUpload = await storage.upload(signaturePath, png, { contentType: "image/png", upsert: false });
    if (sigUpload.error) throw new Error(sigUpload.error.message);
    uploaded.push(signaturePath);
    const pdfUpload = await storage.upload(pdfPath, pdf, { contentType: "application/pdf", upsert: false });
    if (pdfUpload.error) throw new Error(pdfUpload.error.message);
    uploaded.push(pdfPath);

    const meta = await requestMeta();
    const { error: rpcError } = await admin.rpc("sign_rental_amendment", {
      p_token: token,
      p_content_hash: input.contentHash,
      p_document_id: documentId,
      p_version_id: versionId,
      p_pdf_storage_path: pdfPath,
      p_signature_storage_path: signaturePath,
      p_signer_name: signerName,
      p_ip_address: meta.ip,
      p_user_agent: meta.userAgent
    });
    if (rpcError) throw new Error(rpcError.message);
    uploaded.length = 0;

    await applySignedAmendment(admin, amendment.id);
    return { ok: true };
  } catch (error) {
    if (uploaded.length) await storage.remove(uploaded).catch(() => undefined);
    return { ok: false, error: await said(errorMessage(error)) };
  }
}

/**
 * Apply a signed amendment to the rental, once. Claims the amendment by
 * setting applied_at first, so a double submit can't apply it twice.
 */
async function applySignedAmendment(admin: any, amendmentId: string) {
  const { data: claimed } = await admin
    .from("rental_amendments")
    .update({ applied_at: new Date().toISOString() })
    .eq("id", amendmentId)
    .eq("status", "signed")
    .is("applied_at", null)
    .select("*")
    .maybeSingle();
  if (!claimed) return;

  const changes = claimed.changes as AmendmentChanges;
  let { data: rental } = await admin.from("rentals").select("*").eq("id", claimed.rental_id).maybeSingle();
  if (!rental) return;
  const vehicleFailures: string[] = [];
  if (changes.new_vehicle_id) {
    const outcome = await applyVehicleChange(admin, claimed, rental);
    if (outcome === "waiting") {
      // An exchange between two rentals happens when both customers have signed.
      await admin.from("rental_amendments").update({ applied_at: null }).eq("id", claimed.id);
      await recordActivityEvent(admin, {
        organization_id: rental.organization_id,
        entity_type: "rental",
        entity_id: rental.id,
        rental_id: rental.id,
        customer_id: rental.customer_id,
        event_type: "rental_amendment_signed",
        title: "Customer signed the vehicle exchange",
        detail: `${claimed.signer_name} signed. The exchange happens once the other customer has signed too.`,
        metadata: { amendment_id: claimed.id }
      }).catch(() => undefined);
      revalidatePath(`/bookings/${rental.id}`);
      return;
    }
    if (outcome !== "done") vehicleFailures.push(`vehicle: ${outcome}`);
    const reloaded = await admin.from("rentals").select("*").eq("id", claimed.rental_id).maybeSingle();
    if (reloaded.data) rental = reloaded.data;
  }
  const currency = changes.currency || rental.currency || "THB";
  const base = {
    organization_id: rental.organization_id,
    rental_id: rental.id,
    customer_id: rental.customer_id,
    vehicle_id: rental.vehicle_id,
    currency
  };
  const failures: string[] = [...vehicleFailures];

  const rentalUpdate: Record<string, unknown> = {};
  if (changes.new_end_date) rentalUpdate.end_date = changes.new_end_date;
  if (changes.new_rate !== undefined && changes.new_rate !== null) {
    rentalUpdate.rental_rate = changes.new_rate;
    rentalUpdate.contracted_rate = changes.new_rate;
    // Not delivered yet: the first payment collected at delivery is one period of rent.
    if (Number(rental.first_payment_amount || 0) === Number(changes.previous_rate || 0) && rental.payment_due_trigger !== "confirmed") {
      rentalUpdate.first_payment_amount = changes.new_rate;
    }
  }
  if (changes.new_deposit !== undefined && changes.new_deposit !== null) {
    rentalUpdate.deposit_amount = changes.new_deposit;
    // Not collected yet: delivery collects the new amount.
    if (Number(rental.deposit_held || 0) === 0 && Number(rental.deposit_payment_amount || 0) > 0) {
      rentalUpdate.deposit_payment_amount = changes.new_deposit;
    }
  }
  if (Object.keys(rentalUpdate).length) {
    const { error } = await admin.from("rentals").update(rentalUpdate).eq("id", rental.id).eq("organization_id", rental.organization_id);
    if (error) failures.push(`rental: ${error.message}`);
  }

  if (changes.new_end_date && Number(changes.extension_amount || 0) > 0) {
    const due = changes.extension_due_date || changes.previous_end_date || businessToday();
    const { error } = await admin.from("rental_payments").insert({
      ...base,
      due_date: due,
      scheduled_date: due,
      status: "pending",
      amount: changes.extension_amount,
      metadata: {
        type: "extension",
        description: `Extension - ${amendmentDate(changes.previous_end_date)} to ${amendmentDate(changes.new_end_date)}`,
        adjustment_type: "extension",
        previous_end_date: changes.previous_end_date,
        new_end_date: changes.new_end_date,
        amendment_id: claimed.id
      }
    });
    if (error) failures.push(`extension payment: ${error.message}`);
  }

  if (changes.new_rate !== undefined && changes.new_rate !== null && changes.rate_from) {
    const { data: rentRows } = await admin
      .from("rental_payments")
      .select("id, amount, metadata")
      .eq("rental_id", rental.id)
      .in("status", ["scheduled", "pending"])
      .gte("due_date", changes.rate_from)
      .is("deleted_at", null);
    const previousRate = Number(changes.previous_rate || 0);
    for (const row of (rentRows || []).filter((payment: any) => payment.metadata?.type === "rent" && !payment.metadata?.voided)) {
      // Keep part-period (pro-rated) payments in proportion.
      const amount = previousRate > 0 ? Math.round((Number(row.amount) * Number(changes.new_rate)) / previousRate) : Number(changes.new_rate);
      const { error } = await admin
        .from("rental_payments")
        .update({ amount, metadata: { ...(row.metadata || {}), rate_changed_by_amendment: claimed.id, amount_before_amendment: Number(row.amount) } })
        .eq("id", row.id);
      if (error) failures.push(`rent payment ${row.id}: ${error.message}`);
    }
  }

  // Before the deposit is collected (at delivery) the new amount is simply
  // what gets collected. Once it is held, an increase becomes a payment due.
  const topUp = Number(changes.new_deposit ?? 0) - Number(changes.previous_deposit ?? 0);
  const depositAlreadyHeld = Number(rental.deposit_held || 0) > 0;
  if (changes.new_deposit !== undefined && changes.new_deposit !== null && topUp > 0 && depositAlreadyHeld) {
    const due = changes.deposit_due_date || businessToday();
    const { error } = await admin.from("rental_payments").insert({
      ...base,
      due_date: due,
      scheduled_date: due,
      status: "pending",
      amount: topUp,
      metadata: { type: "deposit", is_deposit: true, description: "Security deposit top-up", amendment_id: claimed.id }
    });
    if (error) failures.push(`deposit top-up: ${error.message}`);
  }

  const detail = describeChanges(changes);
  await recordActivityEvent(admin, {
    organization_id: rental.organization_id,
    entity_type: "rental",
    entity_id: rental.id,
    vehicle_id: rental.vehicle_id,
    rental_id: rental.id,
    customer_id: rental.customer_id,
    event_type: failures.length ? "rental_amendment_apply_failed" : "rental_amendment_signed",
    title: failures.length ? "Amendment signed - some changes need checking" : "Customer signed the amendment",
    detail: failures.length ? `${detail} Could not apply: ${failures.join("; ")}` : `${claimed.signer_name} signed. ${detail}`,
    metadata: { amendment_id: claimed.id, document_id: claimed.document_id, failures }
  }).catch(() => undefined);
  await admin
    .from("communication_log")
    .insert({
      organisation_id: rental.organization_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      type: "customer_portal_action",
      channel: "booking_portal",
      direction: "inbound",
      content: `Customer signed an amendment. ${detail}`,
      status: "sent",
      metadata: { amendment_id: claimed.id }
    })
    .then(() => undefined, () => undefined);
  revalidatePath(`/bookings/${rental.id}`);
}

/**
 * Staff change a rental with a return date to monthly, open-ended. Same rules
 * as when a customer asks from their page: monthly rate, a year of rent
 * scheduled from when the paid-for period ends, nothing booked after it. The
 * customer is told.
 */
export async function makeRentalOpenEnded(rentalId: string): Promise<{ ok: true; monthlyRate: number; firstDue: string } | { ok: false; error: string }> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in again.") };
  const admin = createSupabaseAdminClient() as any;
  const { data: rental } = await admin.from("rentals").select("id").eq("id", rentalId).eq("organization_id", membership.organizationId).is("deleted_at", null).maybeSingle();
  if (!rental) return { ok: false, error: await said("Booking not found.") };
  const outcome = await tryAutoExtend(admin, rentalId, null, { openEnded: true, byStaff: true });
  if (!outcome.applied) return { ok: false, error: await said(`Can't make this monthly yet: ${outcome.reason}.`) };
  revalidatePath(`/bookings/${rentalId}`);
  revalidatePath("/bookings");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { ok: true, monthlyRate: outcome.amount, firstDue: outcome.dueDate };
}

/* ------------------------------------------------------------------ */
/* Changing the vehicle on a rental                                    */
/* ------------------------------------------------------------------ */

const ON_RENT = ["active", "due_soon", "overdue", "extended"];

/**
 * Carries out a signed change of vehicle. Returns "done", "waiting" (an
 * exchange whose other customer hasn't signed yet) or the reason it could not
 * be applied.
 */
async function applyVehicleChange(admin: any, amendment: any, rental: any): Promise<string> {
  const changes = amendment.changes as AmendmentChanges;
  const newVehicleId = String(changes.new_vehicle_id);
  const oldVehicleId = String(changes.previous_vehicle_id || rental.vehicle_id);
  const organizationId = rental.organization_id as string;
  const handedOver = ON_RENT.includes(String(rental.status));
  const today = businessToday();
  const early = Boolean(changes.applied_before_signature);
  // Changed ahead of the signature: the vehicle, forms and records were done then.
  if (early && amendment.signed_at) {
    await admin.from("tasks").update({ completed_at: new Date().toISOString(), completion_notes: "Signed" }).eq("rental_id", rental.id).eq("action", "swap_signature").is("completed_at", null);
    return "done";
  }

  if (rental.vehicle_id !== newVehicleId) {
    if (changes.swap_with_rental_id) {
      const { data: partner } = await admin
        .from("rental_amendments")
        .select("id, status")
        .eq("rental_id", changes.swap_with_rental_id)
        .eq("changes->>swap_group", String(changes.swap_group || ""))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!partner || partner.status === "cancelled") return "the other customer's change was cancelled, so the exchange can't happen";
      if (partner.status !== "signed") return "waiting";
      const { error } = await admin.rpc("swap_rental_vehicles", { p_rental_a: rental.id, p_rental_b: changes.swap_with_rental_id });
      if (error) return "the vehicles could not be exchanged because another booking is in the way";
      // The other rental's own paperwork (forms, payments) is finished from its amendment.
      await applySignedAmendment(admin, partner.id);
    } else if (!handedOver) {
      const moved = await moveBookingToVehicle(admin, { organizationId, rentalId: rental.id, vehicleId: newVehicleId });
      if (!moved.ok) return moved.error;
    } else {
      const from = rental.start_date && String(rental.start_date).slice(0, 10) > today ? String(rental.start_date).slice(0, 10) : today;
      const conflict = await vehicleConflictMessage(admin, { organizationId, vehicleId: newVehicleId, startDate: from, endDate: rental.end_date ? String(rental.end_date).slice(0, 10) : null, excludeRentalId: rental.id });
      if (conflict) return "the replacement vehicle has been booked by someone else since this was prepared";
      const { error } = await admin.from("rentals").update({ vehicle_id: newVehicleId, original_vehicle_id: rental.original_vehicle_id || oldVehicleId }).eq("id", rental.id).eq("vehicle_id", oldVehicleId);
      if (error) return "the replacement vehicle has been booked by someone else since this was prepared";
    }
  }

  const quiet = (query: any) => query.then(() => null, () => null);
  await Promise.all([
    // Rent still to come belongs to the vehicle the customer now has.
    quiet(admin.from("rental_payments").update({ vehicle_id: newVehicleId }).eq("rental_id", rental.id).in("status", ["scheduled", "pending", "overdue"])),
    quiet(admin.from("booking_links").update({ vehicle_id: newVehicleId }).eq("rental_id", rental.id)),
    quiet(
      admin.from("vehicle_changes").insert({
        organization_id: organizationId,
        rental_id: rental.id,
        from_vehicle_id: oldVehicleId,
        to_vehicle_id: newVehicleId,
        reason: "other",
        reason_notes: changes.vehicle_change_reason || (changes.swap_with_rental_id ? "Exchange with another rental" : "Vehicle changed"),
        changed_at: new Date().toISOString(),
        changed_by: amendment.created_by,
        original_vehicle_disposition: changes.original_vehicle_disposition === "repair" ? "repair" : "available",
        rate_before: changes.previous_rate ?? rental.rental_rate,
        rate_after: changes.new_rate ?? rental.rental_rate
      })
    )
  ]);
  await syncVehicleStatusFromBookings(admin, organizationId, newVehicleId).catch(() => null);

  if (handedOver) {
    // The customer has a vehicle in their hands: record the one they receive and the one they give back.
    const { data: customer } = rental.customer_id ? await admin.from("customers").select("full_name").eq("id", rental.customer_id).maybeSingle() : { data: null };
    const who = customer?.full_name || "the customer";
    const now = new Date().toISOString();
    // Forms still open from an earlier change on this rental no longer describe what the customer has: close them.
    const { data: stale } = await admin
      .from("tasks")
      .update({ completed_at: now, completion_notes: "Replaced by a later vehicle change" })
      .eq("organization_id", organizationId)
      .eq("rental_id", rental.id)
      .in("action", ["swap_handover", "swap_collection"])
      .is("completed_at", null)
      .select("vehicle_id, action");
    const left = new Set<string>((stale || []).filter((task: any) => task.action === "swap_collection" && task.vehicle_id && task.vehicle_id !== newVehicleId && task.vehicle_id !== oldVehicleId).map((task: any) => String(task.vehicle_id)));
    for (const vehicleId of left) await syncVehicleStatusFromBookings(admin, organizationId, vehicleId).catch(() => null);
    await admin.from("tasks").insert([
      { organization_id: organizationId, vehicle_id: newVehicleId, rental_id: rental.id, title_key: null, created_by: null, title: `Handover form - ${changes.new_vehicle_label || "replacement vehicle"} to ${who}`, task_type: "admin", action: "swap_handover", due_at: now },
      { organization_id: organizationId, vehicle_id: oldVehicleId, rental_id: rental.id, title_key: null, created_by: null, title: `Collection form - ${changes.previous_vehicle_label || "original vehicle"} from ${who}`, task_type: "admin", action: "swap_collection", due_at: now }
    ]);
    if (early) {
      await admin.from("tasks").insert({ organization_id: organizationId, vehicle_id: newVehicleId, rental_id: rental.id, title_key: null, created_by: null, title: `Signature needed - ${who} to sign the change to the ${changes.new_vehicle_label || "replacement vehicle"}`, task_type: "admin", action: "swap_signature", due_at: now });
    } else {
      notifyOperator(organizationId, `🔁 ${who} signed the vehicle change: ${changes.previous_vehicle_label} to ${changes.new_vehicle_label}. Complete the handover and collection forms.`, "portal_action", `/bookings/${rental.id}#vehicle-change-forms`).catch(() => null);
    }
  } else {
    await syncVehicleStatusFromBookings(admin, organizationId, oldVehicleId).catch(() => null);
  }
  revalidatePath("/tasks");
  revalidatePath("/fleet");
  revalidatePath("/calendar");
  return "done";
}

export type VehicleChangeOptions = {
  handedOver: boolean;
  /** False when the customer hasn't signed anything yet: the vehicle is simply changed. */
  needsSignature: boolean;
  signingGaps: string[];
  hasCustomer: boolean;
  currentVehicleLabel: string;
  currentRate: number;
  /** The deposit agreed on this rental. */
  currentDeposit: number;
  currency: string;
  /** `deposit` is what the business normally takes for that vehicle. */
  free: Array<{ vehicleId: string; label: string; plate: string | null; monthlyRate: number; deposit: number }>;
  /** Vehicles out with other customers that could be exchanged for this one. */
  swaps: Array<{ rentalId: string; vehicleId: string; label: string; plate: string | null; customerName: string }>;
};

function freeFrom(rental: any) {
  const today = businessToday();
  const start = String(rental.start_date || today).slice(0, 10);
  return start > today ? start : today;
}

/** What the "Change vehicle" dialog offers for a rental. */
export async function getVehicleChangeOptions(rentalId: string): Promise<Result<VehicleChangeOptions>> {
  try {
    const { organizationId } = await operatorFor(rentalId);
    const admin = createSupabaseAdminClient() as any;
    const ctx = await loadRental(admin, organizationId, rentalId);
    const { rental, organization } = ctx;
    const handedOver = ON_RENT.includes(String(rental.status));
    const gapDays = bookingRules(organization.settings).gapDays;
    const usualDeposit = Math.max(0, Number((organization.settings as any)?.public_booking?.deposit || 0));
    const from = freeFrom(rental);
    const end = cleanDate(rental.end_date);

    const [{ data: vehicles }, busy, { data: others }] = await Promise.all([
      admin.from("vehicles").select("id, make, model, year, registration_number, status, monthly_rate, deposit_amount").eq("organization_id", organizationId).is("deleted_at", null),
      loadBusyPeriods(admin, organizationId),
      handedOver
        ? admin
            .from("rentals")
            .select("id, vehicle_id, start_date, end_date, status, customers!rentals_customer_id_fkey(full_name)")
            .eq("organization_id", organizationId)
            .in("status", ON_RENT)
            .neq("id", rentalId)
            .is("deleted_at", null)
        : Promise.resolve({ data: [] })
    ]);
    const label = (vehicle: any) => [vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";
    const byId = new Map<string, any>((vehicles || []).map((vehicle: any) => [vehicle.id, vehicle]));
    const clear = (vehicleId: string, startDate: string, endDate: string | null, ignore: string[]) =>
      !(busy[vehicleId] || []).some((period) => !ignore.includes(period.rentalId) && clashes(startDate, endDate, period, gapDays));

    const free = ((vehicles || []) as any[])
      .filter((vehicle) => vehicle.id !== rental.vehicle_id && !/sold|retired|inactive|archived|written|maintenance/i.test(String(vehicle.status || "")))
      .filter((vehicle) => clear(vehicle.id, from, end, [rentalId]))
      .map((vehicle) => ({
        vehicleId: String(vehicle.id),
        label: label(vehicle),
        plate: vehicle.registration_number || null,
        monthlyRate: Number(vehicle.monthly_rate || 0),
        deposit: vehicle.deposit_amount === null || vehicle.deposit_amount === undefined ? usualDeposit : Math.max(0, Number(vehicle.deposit_amount) || 0)
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const swaps = ((others || []) as any[])
      .filter((other) => other.customers?.full_name && byId.has(other.vehicle_id))
      // Each vehicle must be free for the other rental's remaining time, ignoring the two rentals themselves.
      .filter((other) => clear(other.vehicle_id, from, end, [rentalId, other.id]) && clear(rental.vehicle_id, businessToday(), cleanDate(other.end_date), [rentalId, other.id]))
      .map((other) => ({ rentalId: String(other.id), vehicleId: String(other.vehicle_id), label: label(byId.get(other.vehicle_id)), plate: byId.get(other.vehicle_id)?.registration_number || null, customerName: String(other.customers.full_name) }));

    return {
      ok: true,
      handedOver,
      needsSignature: handedOver || Boolean(ctx.signedAgreement),
      signingGaps: onlineSigningGaps(organization),
      hasCustomer: Boolean(ctx.customer),
      currentVehicleLabel: label(ctx.vehicle),
      currentRate: Number(rental.rental_rate || 0),
      currentDeposit: Number(rental.deposit_amount || 0),
      currency: String(rental.currency || "THB"),
      free,
      swaps
    };
  } catch (error) {
    return { ok: false, error: await said(errorMessage(error)) };
  }
}

async function insertVehicleAmendment(admin: any, organizationId: string, rentalId: string, userId: string, changes: AmendmentChanges) {
  const ctx = await loadRental(admin, organizationId, rentalId);
  const snapshot = buildBusinessDocumentSnapshot(ctx.organization);
  const html = renderAmendmentHtml(renderInput(ctx, snapshot, changes, businessToday()));
  const { data, error } = await admin
    .from("rental_amendments")
    .insert({ organization_id: organizationId, rental_id: rentalId, changes, rendered_html: html, content_hash: amendmentHash(html), business_snapshot: snapshot, created_by: userId })
    .select("*")
    .single();
  if (error) {
    if (String(error.code) === "23505") throw new Error(`${ctx.customer?.full_name || "This rental"} already has a change waiting to be signed. Cancel it first.`);
    throw new Error(error.message);
  }
  await recordActivityEvent(admin, {
    organization_id: organizationId,
    actor_id: userId,
    entity_type: "rental",
    entity_id: rentalId,
    vehicle_id: ctx.rental.vehicle_id,
    rental_id: rentalId,
    customer_id: ctx.rental.customer_id,
    event_type: "rental_amendment_created",
    title: "Vehicle change sent for signature",
    detail: describeChanges(changes),
    metadata: { amendment_id: data.id }
  }).catch(() => undefined);
  revalidatePath(`/bookings/${rentalId}`);
  return { token: data.token as string, id: data.id as string, customerName: String(ctx.customer?.full_name || "Customer") };
}

/**
 * Change the vehicle on a rental. Once the customer has signed anything, the
 * change is a short document they sign (only what changes), and nothing moves
 * until they do. After a handover it is followed by a handover form for the
 * replacement and a collection form for the original. With `swapRentalId`
 * two rentals exchange vehicles: each customer signs, and the exchange happens
 * when both have.
 */
export async function createVehicleChange(input: {
  rentalId: string;
  vehicleId: string;
  swapRentalId?: string | null;
  reason?: string | null;
  disposition?: "available" | "repair";
  newRate?: number | string | null;
  /** A bigger deposit for the replacement vehicle; leave out to keep (waive the difference). */
  newDeposit?: number | string | null;
  /** The customer can't sign now: change the vehicle straight away and collect the signature after. */
  signLater?: boolean;
}): Promise<Result<{ applied: boolean; links: Array<{ token: string; customerName: string }> }>> {
  const admin = createSupabaseAdminClient() as any;
  try {
    const rentalId = String(input.rentalId || "").trim();
    const { user, organizationId } = await operatorFor(rentalId);
    const options = await getVehicleChangeOptions(rentalId);
    if (!options.ok) return options;
    const ctx = await loadRental(admin, organizationId, rentalId);
    const { rental } = ctx;
    if (["completed", "cancelled"].includes(String(rental.status))) return { ok: false, error: await said("This rental has ended.") };

    const swap = input.swapRentalId ? options.swaps.find((item) => item.rentalId === input.swapRentalId && item.vehicleId === input.vehicleId) : null;
    const target = swap || options.free.find((item) => item.vehicleId === input.vehicleId);
    if (!target) return { ok: false, error: await said("That vehicle is no longer free for this rental's dates. Pick another.") };

    // Nothing signed yet: the customer will sign the agreement with the new vehicle on it.
    if (!options.needsSignature) {
      const moved = await moveBookingToVehicle(admin, { organizationId, rentalId, vehicleId: input.vehicleId });
      if (!moved.ok) return { ok: false, error: moved.error.replace("the other booking's", "this booking's").replace("The other booking", "This booking") };
      await recordActivityEvent(admin, { organization_id: organizationId, actor_id: user.id, entity_type: "rental", entity_id: rentalId, rental_id: rentalId, vehicle_id: input.vehicleId, customer_id: rental.customer_id, event_type: "vehicle_changed", title: "Vehicle changed", detail: `Moved from the ${moved.from} to the ${moved.to} before the customer signed. Dates and price unchanged.` } as any).catch(() => undefined);
      revalidatePath(`/bookings/${rentalId}`);
      revalidatePath("/bookings");
      revalidatePath("/calendar");
      return { ok: true, applied: true, links: [] };
    }

    if (!options.hasCustomer) return { ok: false, error: await said("Assign a customer to this rental first.") };
    if (options.signingGaps.length) return { ok: false, error: await said(`Customers can't sign online until your business adds ${options.signingGaps.join(", ")} in Settings.`) };

    const plateOf = (label: string, plate: string | null) => (plate ? `${label} (${plate})` : label);
    const reason = String(input.reason || "").trim().slice(0, 200) || null;
    const currency = String(rental.currency || "THB");
    const base: AmendmentChanges = { currency, billing_period: String(rental.billing_interval || rental.pricing_model || "monthly") };
    const mine: AmendmentChanges = {
      ...base,
      previous_vehicle_id: rental.vehicle_id,
      previous_vehicle_label: plateOf(options.currentVehicleLabel, ctx.vehicle?.registration_number || null),
      new_vehicle_id: target.vehicleId,
      new_vehicle_label: plateOf(target.label, target.plate),
      vehicle_handed_over: options.handedOver,
      vehicle_change_reason: reason,
      original_vehicle_disposition: swap ? null : input.disposition === "repair" ? "repair" : "available"
    };
    const newRate = cleanAmount(input.newRate);
    if (newRate !== null && newRate > 0 && newRate !== Number(rental.rental_rate || 0)) {
      mine.previous_rate = Number(rental.rental_rate || 0);
      mine.new_rate = newRate;
      mine.rate_from = businessToday();
    }
    const newDeposit = cleanAmount(input.newDeposit);
    if (!swap && newDeposit !== null && newDeposit > Number(rental.deposit_amount || 0)) {
      mine.previous_deposit = Number(rental.deposit_amount || 0);
      mine.new_deposit = newDeposit;
      mine.deposit_due_date = businessToday();
    }

    if (!swap) {
      const signLater = Boolean(input.signLater) && options.handedOver;
      if (signLater) mine.applied_before_signature = businessToday();
      const created = await insertVehicleAmendment(admin, organizationId, rentalId, user.id, mine);
      if (signLater) {
        // The vehicle changes now; the rate and deposit on the form still wait for the signature.
        const outcome = await applyVehicleChange(admin, { changes: mine, created_by: user.id, signed_at: null }, rental);
        if (outcome !== "done") {
          await admin.from("rental_amendments").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: user.id }).eq("id", created.id);
          return { ok: false, error: await said(`Couldn't change the vehicle: ${outcome}.`) };
        }
        await recordActivityEvent(admin, { organization_id: organizationId, actor_id: user.id, entity_type: "rental", entity_id: rentalId, rental_id: rentalId, vehicle_id: target.vehicleId, customer_id: rental.customer_id, event_type: "vehicle_changed", title: "Vehicle changed ahead of the signature", detail: `${mine.previous_vehicle_label} to ${mine.new_vehicle_label}. The customer still has to sign the change.` } as any).catch(() => undefined);
        revalidatePath(`/bookings/${rentalId}`);
      }
      return { ok: true, applied: false, links: [{ token: created.token, customerName: created.customerName }] };
    }

    // An exchange: one short document for each customer.
    const group = randomUUID();
    const otherCtx = await loadRental(admin, organizationId, swap.rentalId);
    const theirs: AmendmentChanges = {
      currency: String(otherCtx.rental.currency || "THB"),
      billing_period: String(otherCtx.rental.billing_interval || otherCtx.rental.pricing_model || "monthly"),
      previous_vehicle_id: otherCtx.rental.vehicle_id,
      previous_vehicle_label: plateOf(swap.label, swap.plate),
      new_vehicle_id: rental.vehicle_id,
      new_vehicle_label: mine.previous_vehicle_label,
      vehicle_handed_over: true,
      vehicle_change_reason: reason,
      swap_with_rental_id: rentalId,
      swap_group: group
    };
    const first = await insertVehicleAmendment(admin, organizationId, rentalId, user.id, { ...mine, swap_with_rental_id: swap.rentalId, swap_group: group });
    try {
      const second = await insertVehicleAmendment(admin, organizationId, swap.rentalId, user.id, theirs);
      return { ok: true, applied: false, links: [{ token: first.token, customerName: first.customerName }, { token: second.token, customerName: second.customerName }] };
    } catch (error) {
      await admin.from("rental_amendments").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: user.id }).eq("id", first.id);
      throw error;
    }
  } catch (error) {
    return { ok: false, error: await said(errorMessage(error)) };
  }
}

/**
 * The sentence the owner sends with a change-signing link, in the customer's
 * own language ("Hi Somchai, please review and sign the change to your rental: ...").
 */
export async function amendmentShareText(token: string, url: string): Promise<string | null> {
  try {
    const admin = createSupabaseAdminClient() as any;
    const { data: amendment } = await admin.from("rental_amendments").select("rental_id").eq("token", token).maybeSingle();
    if (!amendment?.rental_id) return null;
    await operatorFor(amendment.rental_id);
    const { data: rental } = await admin.from("rentals").select("customers!rentals_customer_id_fkey(full_name, preferred_locale)").eq("id", amendment.rental_id).maybeSingle();
    const wording = await customerMessageText(rental?.customers?.preferred_locale);
    const given = String(rental?.customers?.full_name || "").trim().split(/\s+/)[0] || "";
    const hi = given ? wording.t("hi", { name: given }) : wording.t("hiNoName");
    return `${hi} ${wording.t("signChange", { link: url })}`;
  } catch {
    return null;
  }
}
