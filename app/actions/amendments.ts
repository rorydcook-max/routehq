"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { buildBusinessDocumentSnapshot } from "@/lib/business-document-snapshot";
import { businessToday } from "@/lib/business-time";
import { htmlToPdf } from "@/lib/html-to-pdf";
import { onlineSigningGaps } from "@/lib/online-signing-readiness";
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
        signedOn: String(renterSignature.signed_at || "").slice(0, 10) || null,
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
      isIndefinite: Boolean(rental.is_indefinite)
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** Amendments for the booking page. */
export async function listRentalAmendments(rentalId: string): Promise<AmendmentSummary[]> {
  try {
    await operatorFor(rentalId);
    const admin = createSupabaseAdminClient() as any;
    const { data } = await admin
      .from("rental_amendments")
      .select("*")
      .eq("rental_id", rentalId)
      .order("created_at", { ascending: false })
      .limit(20);
    return (data || []).map(amendmentSummary);
  } catch {
    return [];
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
      return { ok: false, error: "This rental has ended, so its agreement can't be amended." };
    }
    if (!ctx.signedAgreement) {
      return { ok: false, error: "The customer hasn't signed the rental agreement yet. Edit the booking instead - they will sign the updated terms." };
    }
    if (!ctx.customer) return { ok: false, error: "Assign a customer to this rental first." };
    const gaps = onlineSigningGaps(organization);
    if (gaps.length) {
      return { ok: false, error: `Customers can't sign online until your business adds ${gaps.join(", ")} in Settings.` };
    }

    const currency = String(rental.currency || "THB");
    const changes: AmendmentChanges = { currency, billing_period: String(rental.billing_interval || rental.pricing_model || "monthly") };
    const previousEnd = cleanDate(rental.end_date);

    const newEndDate = cleanDate(input.newEndDate);
    if (newEndDate) {
      if (rental.is_indefinite) return { ok: false, error: "This rental is open-ended, so it has no return date to extend." };
      if (previousEnd && newEndDate <= previousEnd) return { ok: false, error: "The new return date must be after the current one." };
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
      if (newRate <= 0) return { ok: false, error: "Enter a rate above zero." };
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
      return { ok: false, error: "Nothing to change: set a new return date, rate or deposit." };
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
        return { ok: false, error: "This rental already has an amendment waiting for the customer. Cancel it first to prepare a different one." };
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
    return { ok: false, error: errorMessage(error) };
  }
}

function describeChanges(changes: AmendmentChanges) {
  const parts: string[] = [];
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
    if (!amendment) return { ok: false, error: "Amendment was not found." };
    const { user } = await operatorFor(amendment.rental_id);
    if (amendment.status !== "awaiting_signature") return { ok: false, error: "Only an amendment waiting for a signature can be cancelled." };
    const { error } = await admin
      .from("rental_amendments")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: user.id })
      .eq("id", amendmentId)
      .eq("status", "awaiting_signature");
    if (error) throw new Error(error.message);
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
    return { ok: false, error: errorMessage(error) };
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
    if (!input.accepted) return { ok: false, error: "Please confirm that you agree to the changes." };
    const { data: amendment } = await admin.from("rental_amendments").select("*").eq("token", token).maybeSingle();
    if (!amendment) return { ok: false, error: "This amendment could not be found." };
    if (amendment.status === "signed") return { ok: true };
    if (amendment.status !== "awaiting_signature") return { ok: false, error: "This amendment was cancelled by the rental business." };
    if (new Date(amendment.expires_at).getTime() < Date.now()) return { ok: false, error: "This amendment has expired. Please ask the rental business for a new link." };
    if (input.contentHash !== amendment.content_hash) {
      return { ok: false, error: "The amendment has changed since you opened it. Please reload the page." };
    }

    const { data: customer } = await admin
      .from("rentals")
      .select("customer_id, customers(full_name)")
      .eq("id", amendment.rental_id)
      .maybeSingle();
    const signerName = String(input.signerName || "").trim().slice(0, 120);
    const customerName = String(customer?.customers?.full_name || "").trim();
    if (!signerName) return { ok: false, error: "Please type your full name." };
    if (customerName && !signerName.toLowerCase().includes(customerName.split(/\s+/)[0].toLowerCase())) {
      return { ok: false, error: `Please sign with your name as it appears on the rental (${customerName}).` };
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
    return { ok: false, error: errorMessage(error) };
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
  const { data: rental } = await admin.from("rentals").select("*").eq("id", claimed.rental_id).maybeSingle();
  if (!rental) return;
  const currency = changes.currency || rental.currency || "THB";
  const base = {
    organization_id: rental.organization_id,
    rental_id: rental.id,
    customer_id: rental.customer_id,
    vehicle_id: rental.vehicle_id,
    currency
  };
  const failures: string[] = [];

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
