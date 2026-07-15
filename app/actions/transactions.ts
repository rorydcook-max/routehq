"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logoUrlToDataUri } from "@/lib/contracts";
import { htmlToPdf } from "@/lib/html-to-pdf";
import { normalizeTransactionType } from "@/lib/import/normalize";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildDocumentStoragePath } from "@/services/documents/storage-path";
import { notifyPaymentReceived } from "@/lib/line/notifications";
import { buildPaymentReminderMessage, sendLineMessage } from "@/services/messaging/line";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { findMatchingOutstandingItems } from "@/lib/transaction-matching";

function optionalString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim() || null;
}

function numberField(formData: FormData, key: string) {
  const raw = String(formData.get(key) || "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatReceiptAmount(amount: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(amount);
}

function formatReceiptMethod(value: string) {
  const normalized = value.replace(/_/g, " ").trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Cash";
}

export type GenerateReceiptInput = {
  organisationId?: string;
  organizationId?: string;
  rentalId: string;
  transactionId: string;
  amount: number;
  paymentMethod: string;
  customerName: string;
  vehicleMakeModel: string;
  vehiclePlate: string;
  rentalPeriod: string;
};

export async function generateReceipt(input: GenerateReceiptInput) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to generate a receipt.");
  }

  const organizationId = input.organisationId || input.organizationId;
  const amount = Number(input.amount || 0);

  if (!organizationId || !input.rentalId || !input.transactionId || amount <= 0) {
    throw new Error("Receipt details are incomplete.");
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, settings, logo_url, business_logo_storage_path, receipt_prefix, receipt_footer_text")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError || !organization) {
    throw new Error(organizationError?.message || "Organization not found.");
  }

  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;
  const { count, error: countError } = await supabase
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", organizationId)
    .gte("created_at", yearStart)
    .lt("created_at", yearEnd);

  if (countError) {
    throw new Error(countError.message);
  }

  const prefix = String(organization.receipt_prefix || "REC").trim() || "REC";
  const receiptNumber = `${prefix}-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
  const receiptId = crypto.randomUUID();
  const receiptDate = new Intl.DateTimeFormat("en-TH", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());
  const vehicle = [input.vehicleMakeModel, input.vehiclePlate].filter(Boolean).join(" - ");
  const footerHtml = organization.receipt_footer_text
    ? `<p style="font-size: 12px; color: #717d86; text-align: center; border-top: 1px solid #e3e6e8; padding-top: 12px; margin: 0;">${escapeHtml(organization.receipt_footer_text)}</p>`
    : "";
  const organizationSettings = organization.settings && typeof organization.settings === "object" && !Array.isArray(organization.settings)
    ? (organization.settings as Record<string, unknown>)
    : {};
  const logoDataUri = await logoUrlToDataUri(supabase, String(organization.business_logo_storage_path || organizationSettings.business_logo_storage_path || organization.logo_url || ""));
  const receiptBrandHtml = logoDataUri
    ? `<img src="${escapeHtml(logoDataUri)}" alt="${escapeHtml(organization.name || "RouteHQ")} logo" style="max-width: 200px; max-height: 80px; object-fit: contain; margin: 0 auto 8px; display: block;" />`
    : `<p style="font-size: 20px; font-weight: 700; color: #1a1d21; margin: 4px 0;">${escapeHtml(organization.name || "RouteHQ")}</p>`;

  const receiptHtml = `
<div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 24px; border: 1px solid #e3e6e8; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 20px;">
    <p style="font-size: 11px; color: #717d86; margin: 0; letter-spacing: 0.08em; text-transform: uppercase;">RECEIPT</p>
    ${receiptBrandHtml}
    <p style="font-size: 13px; color: #454d54; margin: 0;">${escapeHtml(receiptNumber)} · ${escapeHtml(receiptDate)}</p>
  </div>
  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; text-align: center; margin-bottom: 20px;">
    <p style="font-size: 11px; color: #16a34a; margin: 0; font-weight: 600; letter-spacing: 0.08em;">PAID</p>
    <p style="font-size: 28px; font-weight: 700; color: #16a34a; margin: 4px 0;">฿${formatReceiptAmount(amount)}</p>
    <p style="font-size: 12px; color: #16a34a; margin: 0;">${escapeHtml(formatReceiptMethod(input.paymentMethod))}</p>
  </div>
  <div style="margin-bottom: 16px;">
    <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f3f4; font-size: 13px;">
      <span style="color: #717d86;">Customer</span><span style="color: #1a1d21; font-weight: 500;">${escapeHtml(input.customerName)}</span>
    </div>
    <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f3f4; font-size: 13px;">
      <span style="color: #717d86;">Vehicle</span><span style="color: #1a1d21; font-weight: 500;">${escapeHtml(vehicle)}</span>
    </div>
    <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
      <span style="color: #717d86;">Rental period</span><span style="color: #1a1d21; font-weight: 500;">${escapeHtml(input.rentalPeriod)}</span>
    </div>
  </div>
  ${footerHtml}
</div>`;

  const pdf = await htmlToPdf(receiptHtml);
  const storagePath = `${organizationId}/receipts/${receiptId}.pdf`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, pdf, {
    contentType: "application/pdf",
    upsert: true
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  // NOTE: signed URLs expire after 1 year. If receipts need to remain accessible
  // long-term, switch to storing storagePath and regenerating signed URLs on read.
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  if (signedUrlError) {
    throw new Error(`Failed to generate receipt URL: ${signedUrlError.message}`);
  }

  const pdfUrl = signedUrlData?.signedUrl || storagePath;

  const { error: receiptError } = await supabase.from("receipts").insert({
    id: receiptId,
    organisation_id: organizationId,
    rental_id: input.rentalId,
    transaction_id: input.transactionId,
    receipt_number: receiptNumber,
    amount,
    payment_method: input.paymentMethod,
    pdf_url: pdfUrl
  });

  if (receiptError) {
    throw new Error(receiptError.message);
  }

  const { error: transactionError } = await supabase
    .from("transactions")
    .update({ receipt_url: pdfUrl })
    .eq("id", input.transactionId)
    .eq("organization_id", organizationId);

  if (transactionError) {
    throw new Error(transactionError.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "transaction",
    entity_id: input.transactionId,
    rental_id: input.rentalId,
    event_type: "receipt_generated",
    title: `Receipt generated: ${receiptNumber}`,
    detail: `Receipt for ${formatReceiptAmount(amount)} THB generated.`
  });

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath(`/bookings/${input.rentalId}`);

  return { receipt_number: receiptNumber, pdf_url: pdfUrl };
}

export async function recordDeliveryCashPaymentAndReceipt(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to record a payment.");
  }

  const organizationId = String(formData.get("organizationId") || "");
  const rentalId = String(formData.get("rentalId") || "");
  const vehicleId = String(formData.get("vehicleId") || "");
  const customerId = optionalString(formData, "customerId");
  const fallbackAmount = numberField(formData, "amount") || 0;
  const rentalPaymentAmount = Math.max(0, numberField(formData, "rentalPaymentAmount") ?? fallbackAmount);
  const depositAmount = Math.max(0, numberField(formData, "depositAmount") || 0);
  const amount = rentalPaymentAmount + depositAmount;
  const customerName = String(formData.get("customerName") || "Customer");
  const vehicleMakeModel = String(formData.get("vehicleMakeModel") || "Vehicle");
  const vehiclePlate = String(formData.get("vehiclePlate") || "");
  const rentalPeriod = String(formData.get("rentalPeriod") || "Rental");
  const paymentMethod = String(formData.get("paymentMethod") || "cash");

  if (!organizationId || !rentalId || !vehicleId || amount === null || amount <= 0) {
    throw new Error("A positive cash payment amount is required.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, organization_id, vehicle_id, customer_id, currency, balance_due, deposit_held, deposit_status, deposit_received_at")
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (rentalError || !rental) {
    throw new Error(rentalError?.message || "Rental could not be found.");
  }

  const { data: existingPayments, error: existingPaymentsError } = await supabase
    .from("rental_payments")
    .select("id, amount, status, metadata")
    .eq("organization_id", organizationId)
    .eq("rental_id", rentalId)
    .is("deleted_at", null);

  if (existingPaymentsError) {
    throw new Error(existingPaymentsError.message);
  }

  const paymentRows = Array.isArray(existingPayments) ? existingPayments : [];
  async function upsertPaidPayment(kind: "rent" | "deposit", paymentAmount: number, description: string) {
    if (paymentAmount <= 0) return null;
    const existing = paymentRows.find((payment: any) => String(payment.metadata?.type || "").toLowerCase() === kind && !["paid", "voided"].includes(String(payment.status || "")));
    const paymentPayload = {
      amount: paymentAmount,
      status: "paid",
      paid_at: now,
      paid_date: today,
      payment_method: paymentMethod,
      currency: rental.currency || "THB",
      metadata: {
        ...(existing?.metadata || {}),
        type: kind,
        description,
        payment_trigger: "delivery_inspection",
        source: "delivery_inspection"
      }
    };

    if (existing?.id) {
      const { data: updatedPayment, error: updatePaymentError } = await supabase
        .from("rental_payments")
        .update(paymentPayload)
        .eq("id", existing.id)
        .eq("organization_id", organizationId)
        .select("id")
        .single();
      if (updatePaymentError || !updatedPayment) {
        throw new Error(updatePaymentError?.message || "Unable to update payment record.");
      }
      return updatedPayment.id as string;
    }

    const { data: insertedPayment, error: insertPaymentError } = await supabase
      .from("rental_payments")
      .insert({
        organization_id: organizationId,
        rental_id: rentalId,
        customer_id: customerId || rental.customer_id,
        vehicle_id: vehicleId,
        due_date: today,
        scheduled_date: today,
        ...paymentPayload
      })
      .select("id")
      .single();

    if (insertPaymentError || !insertedPayment) {
      throw new Error(insertPaymentError?.message || "Unable to create payment record.");
    }
    return insertedPayment.id as string;
  }

  const rentPaymentId = await upsertPaidPayment("rent", rentalPaymentAmount, "Rental payment received during delivery inspection");
  const depositPaymentId = await upsertPaidPayment("deposit", depositAmount, "Security deposit received during delivery inspection");

  async function insertPaymentTransaction(type: "rental_income" | "deposit_received", transactionAmount: number, rentalPaymentId: string | null) {
    if (transactionAmount <= 0) return null;
    const { data: transaction, error } = await supabase
      .from("transactions")
      .insert({
        organization_id: organizationId,
        vehicle_id: vehicleId,
        rental_id: rentalId,
        customer_id: customerId,
        rental_payment_id: rentalPaymentId,
        type,
        amount: transactionAmount,
        currency: rental.currency || "THB",
        transaction_date: today,
        supplier: "Cash",
        notes: type === "deposit_received" ? "Security deposit received during delivery inspection." : "Cash rental payment confirmed during delivery inspection.",
        metadata: { source: "delivery_inspection", payment_method: paymentMethod },
        is_deposit: type === "deposit_received",
        deposit_rental_id: type === "deposit_received" ? rentalId : null,
        created_by: user.id
      })
      .select("id")
      .single();

    if (error || !transaction) {
      throw new Error(error?.message || "Unable to record cash payment.");
    }

    if (rentalPaymentId) {
      const { error: linkError } = await supabase
        .from("rental_payments")
        .update({ transaction_id: transaction.id })
        .eq("id", rentalPaymentId)
        .eq("organization_id", organizationId);
      if (linkError) {
        throw new Error(linkError.message);
      }
    }

    return transaction;
  }

  const rentTransaction = await insertPaymentTransaction("rental_income", rentalPaymentAmount, rentPaymentId);
  const depositTransaction = await insertPaymentTransaction("deposit_received", depositAmount, depositPaymentId);
  const receiptTransaction = rentTransaction || depositTransaction;

  const rentalUpdate: Record<string, unknown> = {
    payment_due_after_delivery: false,
    balance_due: Math.max(0, Number(rental.balance_due || 0) - amount)
  };
  if (depositAmount > 0) {
    rentalUpdate.deposit_held = depositAmount;
    rentalUpdate.deposit_status = "received";
    rentalUpdate.deposit_received_at = rental.deposit_received_at || now;
  }
  const { error: rentalUpdateError } = await supabase
    .from("rentals")
    .update(rentalUpdate)
    .eq("id", rentalId)
    .eq("organization_id", organizationId);

  if (rentalUpdateError) {
    throw new Error(rentalUpdateError.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "transaction",
    entity_id: receiptTransaction?.id,
    vehicle_id: vehicleId,
    rental_id: rentalId,
    customer_id: customerId,
    event_type: "payment_received",
    title: "Cash payment received",
    detail: `Rental payment ${rentalPaymentAmount} THB and deposit ${depositAmount} THB confirmed during delivery inspection.`
  });

  if (rentalPaymentAmount > 0) {
    const vehicleLabel = [vehicleMakeModel, vehiclePlate].filter(Boolean).join(" ");
    notifyPaymentReceived({ amount: rentalPaymentAmount, customerName, vehicleLabel }).catch(() => null);
  }

  try {
    return await generateReceipt({
      organisationId: organizationId,
      rentalId,
      transactionId: receiptTransaction.id,
      amount: rentalPaymentAmount > 0 ? rentalPaymentAmount : amount,
      paymentMethod,
      customerName,
      vehicleMakeModel,
      vehiclePlate,
      rentalPeriod
    });
  } catch (receiptError) {
    console.error("Receipt generation failed after payment was recorded:", receiptError);
    return {
      receipt_number: "RECEIPT-PENDING",
      pdf_url: "",
      warning: "Payment recorded successfully. Receipt generation failed — you can regenerate from the booking page."
    };
  }
}

export async function createTransaction(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to add a transaction.");
  }

  const organizationId = String(formData.get("organizationId") || "");
  const vehicleId = String(formData.get("vehicleId") || "");
  const type = normalizeTransactionType(formData.get("type"));
  const amount = numberField(formData, "amount");
  const transactionDate = optionalString(formData, "transactionDate") || new Date().toISOString().slice(0, 10);

  if (!organizationId || !vehicleId || amount === null || amount <= 0) {
    throw new Error("Vehicle, type, and a positive amount are required.");
  }

  const rentalId = optionalString(formData, "rentalId");
  const customerId = optionalString(formData, "customerId");
  const rentalPaymentId = optionalString(formData, "rentalPaymentId");
  const linkedTaskId = optionalString(formData, "taskId");
  const receipt = formData.get("receipt");

  let receiptDocumentId: string | null = null;

  if (receipt instanceof File && receipt.size > 0) {
    const storagePath = buildDocumentStoragePath({
      organizationId,
      ownerType: "transaction",
      ownerId: vehicleId,
      fileName: receipt.name || "receipt.upload"
    });

    const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, receipt, {
      contentType: receipt.type || undefined,
      upsert: false
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .insert({
        organization_id: organizationId,
        owner_type: "transaction",
        owner_id: vehicleId,
        storage_bucket: "documents",
        storage_path: storagePath,
        file_name: receipt.name || "receipt.upload",
        mime_type: receipt.type || null,
        size_bytes: receipt.size,
        category: "receipt",
        ocr_status: "queued",
        extracted_data: {},
        uploaded_by: user.id
      })
      .select("id")
      .single();

    if (documentError) {
      throw new Error(documentError.message);
    }

    receiptDocumentId = document.id;
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      organization_id: organizationId,
      vehicle_id: vehicleId,
      rental_id: rentalId,
      customer_id: customerId,
      type,
      amount,
      currency: "THB",
      transaction_date: transactionDate,
      supplier: optionalString(formData, "supplier"),
      mileage: numberField(formData, "mileage"),
      notes: optionalString(formData, "notes"),
      receipt_document_id: receiptDocumentId,
      created_by: user.id
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (rentalPaymentId) {
    const { error: paymentLinkError } = await supabase
      .from("rental_payments")
      .update({
        status: "paid",
        paid_at: new Date(`${transactionDate}T00:00:00.000Z`).toISOString(),
        paid_date: transactionDate,
        transaction_id: data.id
      })
      .eq("id", rentalPaymentId)
      .eq("organization_id", organizationId);

    if (paymentLinkError) {
      throw new Error(paymentLinkError.message);
    }
  }

  if (linkedTaskId) {
    const { error: taskError } = await supabase
      .from("tasks")
      .update({
        completed_at: new Date().toISOString(),
        completion_notes: rentalPaymentId ? "Completed by linked payment transaction." : "Completed by linked transaction."
      })
      .eq("id", linkedTaskId)
      .eq("organization_id", organizationId);

    if (taskError) {
      throw new Error(taskError.message);
    }
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "transaction",
    entity_id: data.id,
    vehicle_id: vehicleId,
    rental_id: rentalId,
    customer_id: customerId,
    event_type: "transaction_created",
    title: `Transaction recorded: ${type}`,
    detail: rentalPaymentId ? `Amount ${amount} THB linked to rental payment.` : `Amount ${amount} THB`
  });

  if (type === "rental_income") {
    const [vehicleRes, customerRes] = await Promise.all([
      supabase.from("vehicles").select("make, model, registration_number").eq("id", vehicleId).maybeSingle(),
      customerId ? supabase.from("customers").select("full_name").eq("id", customerId).maybeSingle() : Promise.resolve({ data: null })
    ]);
    const v = vehicleRes.data;
    const vehicleLabel = v ? `${v.make} ${v.model} (${v.registration_number})` : vehicleId;
    const customerName = customerRes.data?.full_name || "Customer";
    notifyPaymentReceived({ amount, customerName, vehicleLabel }).catch(() => null);
  }

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath(`/fleet/${vehicleId}`);
  if (rentalId) {
    revalidatePath(`/bookings/${rentalId}`);
  }

  if (rentalPaymentId) {
    redirect("/transactions?linked=payment");
  }
  if (linkedTaskId) {
    redirect("/transactions?linked=task");
  }
  redirect("/transactions");
}

export async function findTransactionMatches(formData: FormData) {
  const organizationId = String(formData.get("organizationId") || "");
  const type = String(formData.get("type") || "");
  const amountRaw = String(formData.get("amount") || "").trim();
  const amount = amountRaw ? Number(amountRaw) : null;
  const vehicleId = optionalString(formData, "vehicleId");
  const date = optionalString(formData, "transactionDate") || new Date().toISOString().slice(0, 10);

  return findMatchingOutstandingItems(organizationId, type, Number.isFinite(amount) ? amount : null, vehicleId, date);
}

type TransactionCorrection = {
  amount: number;
  date: string;
  description?: string | null;
  type: string;
  vehicleId?: string | null;
};

async function ensureTransactionMembership(supabase: any, organizationId: string, userId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "You do not have access to this organization.");
  }
}

function amountFromCorrection(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateOnly(value: string | null | undefined) {
  return String(value || "").slice(0, 10);
}

export async function updateTransaction(transactionId: string, fields: TransactionCorrection) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const cleanTransactionId = String(transactionId || "").trim();
  const amount = amountFromCorrection(fields.amount);
  const transactionDate = dateOnly(fields.date);
  const type = normalizeTransactionType(fields.type);
  const description = String(fields.description || "").trim() || null;

  if (!cleanTransactionId || !transactionDate) {
    throw new Error("Transaction and date are required.");
  }

  const { data: transaction, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", cleanTransactionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !transaction) {
    throw new Error(error?.message || "Transaction was not found.");
  }

  await ensureTransactionMembership(supabase, transaction.organization_id, user.id);

  const vehicleId = String(fields.vehicleId || "").trim() || transaction.vehicle_id;

  if (vehicleId && vehicleId !== transaction.vehicle_id) {
    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id")
      .eq("id", vehicleId)
      .eq("organization_id", transaction.organization_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (vehicleError || !vehicle) {
      throw new Error(vehicleError?.message || "Selected vehicle was not found.");
    }
  }

  const oldAmount = Number(transaction.amount || 0);
  const oldType = String(transaction.type || "");
  const oldDate = dateOnly(transaction.transaction_date);
  const oldDescription = transaction.notes || "";
  const metadata = {
    ...(transaction.metadata || {}),
    corrected_at: new Date().toISOString(),
    corrected_by: user.id,
    correction_history: [
      ...((Array.isArray(transaction.metadata?.correction_history) && transaction.metadata.correction_history) || []),
      {
        at: new Date().toISOString(),
        by: user.id,
        old_amount: oldAmount,
        new_amount: amount,
        old_type: oldType,
        new_type: type,
        old_date: oldDate,
        new_date: transactionDate,
        old_vehicle_id: transaction.vehicle_id,
        new_vehicle_id: vehicleId,
        old_description: oldDescription,
        new_description: description
      }
    ]
  };

  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      amount,
      transaction_date: transactionDate,
      type,
      vehicle_id: vehicleId,
      notes: description,
      metadata
    })
    .eq("id", transaction.id)
    .eq("organization_id", transaction.organization_id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const detail = `Transaction corrected: ${oldType} THB ${Math.round(oldAmount).toLocaleString()} -> ${type} THB ${Math.round(amount).toLocaleString()}${description ? ` (${description})` : ""}`;
  await recordActivityEvent(supabase, {
    organization_id: transaction.organization_id,
    actor_id: user.id,
    entity_type: "transaction",
    entity_id: transaction.id,
    vehicle_id: vehicleId,
    rental_id: transaction.rental_id,
    customer_id: transaction.customer_id,
    event_type: "correction",
    title: "Transaction corrected",
    detail,
    metadata: { type: "correction", content: detail, old_amount: oldAmount, new_amount: amount }
  });

  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/");
  revalidatePath(`/fleet/${vehicleId}`);
  if (transaction.vehicle_id && transaction.vehicle_id !== vehicleId) {
    revalidatePath(`/fleet/${transaction.vehicle_id}`);
  }
  if (transaction.rental_id) {
    revalidatePath(`/bookings/${transaction.rental_id}`);
  }

  return { success: true };
}

export async function deleteTransaction(transactionId: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const cleanTransactionId = String(transactionId || "").trim();
  if (!cleanTransactionId) {
    throw new Error("Transaction is required.");
  }

  const { data: transaction, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", cleanTransactionId)
    .maybeSingle();

  if (error || !transaction) {
    throw new Error(error?.message || "Transaction was not found.");
  }

  await ensureTransactionMembership(supabase, transaction.organization_id, user.id);

  const isDeposit = Boolean(transaction.is_deposit) || ["deposit", "deposit_received", "deposit_refunded"].includes(String(transaction.type || ""));

  // Clear any linked receipt and rental_payment references before deleting
  await supabase
    .from("receipts")
    .update({ transaction_id: null })
    .eq("transaction_id", transaction.id);

  await supabase
    .from("rental_payments")
    .update({ transaction_id: null })
    .eq("transaction_id", transaction.id);

  const { error: deleteError } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transaction.id)
    .eq("organization_id", transaction.organization_id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (transaction.rental_id) {
    await recordActivityEvent(supabase, {
      organization_id: transaction.organization_id,
      actor_id: user.id,
      entity_type: "transaction",
      entity_id: transaction.id,
      vehicle_id: transaction.vehicle_id,
      rental_id: transaction.rental_id,
      customer_id: transaction.customer_id,
      event_type: "correction",
      title: "Transaction deleted",
      detail: `Transaction deleted: ${String(transaction.type || "").replace(/_/g, " ")} THB ${Math.round(Math.abs(Number(transaction.amount || 0))).toLocaleString()}`,
      metadata: { deleted_transaction_id: transaction.id, is_deposit: isDeposit }
    });
  }

  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/");
  if (transaction.vehicle_id) revalidatePath(`/fleet/${transaction.vehicle_id}`);
  if (transaction.rental_id) revalidatePath(`/bookings/${transaction.rental_id}`);

  return { success: true, warning: isDeposit ? "Deposit transaction deleted." : null };
}

export async function bulkDeleteTransactions(ids: string[]) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const cleanIds = Array.from(new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean)));
  if (cleanIds.length === 0) {
    return { success: true, deleted: 0 };
  }

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("id, organization_id, vehicle_id, rental_id")
    .in("id", cleanIds);

  if (error) {
    throw new Error(error.message);
  }

  const orgIds = Array.from(
    new Set<string>((transactions || []).map((transaction: any) => String(transaction.organization_id || "")).filter(Boolean))
  );
  for (const organizationId of orgIds) {
    await ensureTransactionMembership(supabase, organizationId, user.id);
  }

  const verifiedIds = (transactions || []).map((transaction: any) => transaction.id);
  if (verifiedIds.length === 0) {
    return { success: true, deleted: 0 };
  }

  // Clear any linked receipt and rental_payment references before bulk deleting
  await supabase
    .from("receipts")
    .update({ transaction_id: null })
    .in("transaction_id", verifiedIds);

  await supabase
    .from("rental_payments")
    .update({ transaction_id: null })
    .in("transaction_id", verifiedIds);

  const { error: deleteError } = await supabase
    .from("transactions")
    .delete()
    .in("id", verifiedIds);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/");

  return { success: true, deleted: verifiedIds.length };
}


export async function sendPaymentReminder(
  rentalId: string
): Promise<{ success: boolean; whatsappUrl?: string; message?: string }> {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  // Fetch rental, customer, vehicle, org in parallel
  const { data: rental } = await supabase
    .from("rentals")
    .select(
      "id, balance_due, end_date, organization_id, currency, vehicles!rentals_vehicle_id_fkey(make, model, registration_number), customers!rentals_customer_id_fkey(id, full_name, phone, line_id, whatsapp_number)"
    )
    .eq("id", rentalId)
    .maybeSingle();

  if (!rental) return { success: false, message: "Rental not found." };

  const admin = createSupabaseAdminClient() as any;
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, promptpay_id, line_channel_access_token, line_user_id")
    .eq("id", rental.organization_id)
    .maybeSingle();

  if (!org) return { success: false, message: "Organization not found." };

  const customer = rental.customers;
  const vehicle = rental.vehicles;
  const balanceDue = Number(rental.balance_due || 0);
  const dueDateLabel = rental.end_date
    ? new Date(rental.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "your next payment date";

  const vLabel = vehicle
    ? `${vehicle.make} ${vehicle.model} (${vehicle.registration_number})`
    : "your rental vehicle";

  const msgObj = buildPaymentReminderMessage({
    customerName: customer?.full_name ?? "Customer",
    vehicleLabel: vLabel,
    amount: balanceDue,
    dueDate: dueDateLabel,
    promptpayId: org.promptpay_id ?? null,
    ownerName: org.name,
    ownerPhone: ""
  });

  let lineSent = false;
  if (customer?.line_id) {
    const accessToken: string =
      org.line_channel_access_token ?? process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
    if (accessToken) {
      const result = await sendLineMessage(accessToken, customer.line_id, [msgObj]);
      lineSent = result.success;

      await admin.from("line_messages").insert({
        organisation_id: org.id,
        type: "payment_reminder",
        recipient_line_id: customer.line_id,
        message_content: msgObj,
        status: result.success ? "sent" : "failed",
        sent_at: result.success ? new Date().toISOString() : null,
        error: result.error ?? null,
        rental_id: rentalId,
        customer_id: customer?.id ?? null
      });
    }
  }

  // Construct WhatsApp deep-link if customer has a WhatsApp number
  let whatsappUrl: string | undefined;
  if (customer?.whatsapp_number) {
    const digits = String(customer.whatsapp_number).replace(/\D/g, "");
    const normalized = digits.startsWith("66") ? digits : digits.startsWith("0") ? `66${digits.slice(1)}` : digits;
    const text = encodeURIComponent(
      `Hi ${customer.full_name ?? ""},\n\nPayment reminder for ${vLabel}:\nAmount due: ฿${balanceDue.toLocaleString("en-US")}\nDue: ${dueDateLabel}${org.promptpay_id ? `\n\nPromptPay: ${org.promptpay_id}` : ""}\n\nThank you 🙏`
    );
    whatsappUrl = `https://wa.me/${normalized}?text=${text}`;
  }

  return {
    success: lineSent || Boolean(whatsappUrl),
    whatsappUrl,
    message: lineSent ? "Reminder sent via LINE" : whatsappUrl ? "Opening WhatsApp with reminder message" : "No contact channel available"
  };
}
