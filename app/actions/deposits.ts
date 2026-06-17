"use server";

import { revalidatePath } from "next/cache";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function optionalString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim() || null;
}

function money(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(value);
}

function numberFromForm(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").replace(/,/g, "").trim();
  const parsed = value ? Number(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function depositStatusFor(held: number, refunded: number, forfeited: number) {
  if (held <= 0) return "pending";
  const totalResolved = refunded + forfeited;
  if (refunded >= held && forfeited <= 0) return "fully_returned";
  if (forfeited >= held && refunded <= 0) return "forfeited";
  if (totalResolved >= held && forfeited > 0) return "partially_forfeited";
  if (refunded > 0) return "partially_returned";
  if (forfeited > 0) return "partially_forfeited";
  return "received";
}

async function getRentalForDeposit(supabase: any, organizationId: string, rentalId: string) {
  const { data: rental, error } = await supabase
    .from("rentals")
    .select("id, organization_id, vehicle_id, customer_id, deposit_amount, rental_rate, deposit_held, deposit_status, deposit_refunded_amount, deposit_forfeited_amount, deposit_reconciled_at, deposit_reconciled_by, currency")
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !rental) {
    throw new Error(error?.message || "Booking was not found.");
  }

  return rental;
}

async function currentUser(supabase: any) {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  return user;
}

export async function markDepositReceived(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const user = await currentUser(supabase);
  const organizationId = requiredString(formData, "organizationId");
  const rentalId = requiredString(formData, "rentalId");
  const rental = await getRentalForDeposit(supabase, organizationId, rentalId);
  const depositAmount = Number(rental.deposit_amount || 0);

  if (depositAmount <= 0) {
    throw new Error("This booking has no deposit amount to receive.");
  }

  const now = new Date().toISOString();
  const { error: rentalError } = await supabase
    .from("rentals")
    .update({
      deposit_held: depositAmount,
      deposit_status: "received",
      deposit_received_at: now
    })
    .eq("id", rentalId)
    .eq("organization_id", organizationId);

  if (rentalError) {
    throw new Error(rentalError.message);
  }

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .insert({
      organization_id: organizationId,
      vehicle_id: rental.vehicle_id,
      rental_id: rentalId,
      customer_id: rental.customer_id,
      type: "deposit_received",
      amount: depositAmount,
      currency: rental.currency || "THB",
      transaction_date: now.slice(0, 10),
      notes: "Security deposit received",
      metadata: { description: "Security deposit received" },
      is_deposit: true,
      deposit_rental_id: rentalId,
      created_by: user.id
    })
    .select("id")
    .single();

  if (transactionError) {
    throw new Error(transactionError.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rentalId,
    vehicle_id: rental.vehicle_id,
    rental_id: rentalId,
    customer_id: rental.customer_id,
    event_type: "deposit_received",
    title: "Security deposit received",
    detail: `Security deposit of ${money(depositAmount)} received.`,
    metadata: { transaction_id: transaction.id, amount: depositAmount }
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rentalId}`);
}

export async function confirmCustomerPayment(rentalId: string, amount: number, paymentMethod: string | null) {
  const supabase = (await createSupabaseServerClient()) as any;
  const user = await currentUser(supabase);

  const { data: bookingLink, error: bookingLinkError } = await supabase
    .from("booking_links")
    .select("id, organization_id, rental_id, vehicle_id, customer_id, preferred_payment_method, payment_reported_by_customer")
    .eq("rental_id", rentalId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bookingLinkError || !bookingLink) {
    throw new Error(bookingLinkError?.message || "Booking link was not found.");
  }

  const rental = await getRentalForDeposit(supabase, bookingLink.organization_id, rentalId);
  const fallbackAmount = Number(rental.deposit_amount || rental.rental_rate || 0);
  const paymentAmount = Number.isFinite(Number(amount)) && Number(amount) > 0 ? Number(amount) : fallbackAmount;

  if (paymentAmount <= 0) {
    throw new Error("No payable amount is available for this booking.");
  }

  const method = paymentMethod || bookingLink.preferred_payment_method || "unknown";
  const now = new Date().toISOString();
  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .insert({
      organization_id: bookingLink.organization_id,
      vehicle_id: rental.vehicle_id,
      rental_id: rentalId,
      customer_id: rental.customer_id || bookingLink.customer_id,
      type: "rental_income",
      amount: paymentAmount,
      currency: rental.currency || "THB",
      transaction_date: now.slice(0, 10),
      notes: `Customer-reported payment confirmed: ${method}`,
      metadata: { description: "Customer-reported payment confirmed", payment_method: method },
      is_deposit: false,
      created_by: user.id
    })
    .select("id")
    .single();

  if (transactionError) {
    throw new Error(transactionError.message);
  }

  const { error: bookingUpdateError } = await supabase
    .from("booking_links")
    .update({ payment_reported_by_customer: false })
    .eq("id", bookingLink.id)
    .eq("organization_id", bookingLink.organization_id);

  if (bookingUpdateError) {
    throw new Error(bookingUpdateError.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: bookingLink.organization_id,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rentalId,
    vehicle_id: rental.vehicle_id,
    rental_id: rentalId,
    customer_id: rental.customer_id || bookingLink.customer_id,
    event_type: "payment_confirmed",
    title: "Payment confirmed",
    detail: `Payment confirmed - ${method}.`,
    metadata: { transaction_id: transaction.id, amount: paymentAmount, payment_method: method }
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rentalId}`);
}

export async function returnDeposit(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const user = await currentUser(supabase);
  const organizationId = requiredString(formData, "organizationId");
  const rentalId = requiredString(formData, "rentalId");
  const returnAmount = numberFromForm(formData, "returnAmount");
  const notes = optionalString(formData, "notes");
  const rental = await getRentalForDeposit(supabase, organizationId, rentalId);

  const held = Number(rental.deposit_held || 0);
  const refunded = Number(rental.deposit_refunded_amount || 0);
  const forfeited = Number(rental.deposit_forfeited_amount || 0);
  const available = Math.max(0, held - refunded - forfeited);

  if (returnAmount <= 0) {
    throw new Error("Enter a deposit return amount.");
  }
  if (returnAmount > available) {
    throw new Error("Return amount cannot exceed the remaining deposit held.");
  }

  const nextRefunded = refunded + returnAmount;
  const nextStatus = depositStatusFor(held, nextRefunded, forfeited);
  const now = new Date().toISOString();

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .insert({
      organization_id: organizationId,
      vehicle_id: rental.vehicle_id,
      rental_id: rentalId,
      customer_id: rental.customer_id,
      type: "deposit_refunded",
      amount: returnAmount,
      currency: rental.currency || "THB",
      transaction_date: now.slice(0, 10),
      notes: notes ? `Security deposit refunded. ${notes}` : "Security deposit refunded",
      metadata: { description: "Security deposit refunded", notes },
      is_deposit: true,
      deposit_rental_id: rentalId,
      created_by: user.id
    })
    .select("id")
    .single();

  if (transactionError) {
    throw new Error(transactionError.message);
  }

  const { error: rentalError } = await supabase
    .from("rentals")
    .update({
      deposit_refunded_amount: nextRefunded,
      deposit_status: nextStatus,
      deposit_reconciled_at: nextRefunded + forfeited >= held ? now : rental.deposit_reconciled_at,
      deposit_reconciled_by: nextRefunded + forfeited >= held ? user.id : rental.deposit_reconciled_by
    })
    .eq("id", rentalId)
    .eq("organization_id", organizationId);

  if (rentalError) {
    throw new Error(rentalError.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rentalId,
    vehicle_id: rental.vehicle_id,
    rental_id: rentalId,
    customer_id: rental.customer_id,
    event_type: "deposit_refunded",
    title: "Deposit returned",
    detail: `Deposit of ${money(returnAmount)} returned to customer.`,
    metadata: { transaction_id: transaction.id, amount: returnAmount, notes }
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rentalId}`);
}

export async function applyDepositDeduction(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const user = await currentUser(supabase);
  const organizationId = requiredString(formData, "organizationId");
  const rentalId = requiredString(formData, "rentalId");
  const deductionAmount = numberFromForm(formData, "deductionAmount");
  const reason = requiredString(formData, "reason");
  const notes = optionalString(formData, "notes");
  const rental = await getRentalForDeposit(supabase, organizationId, rentalId);

  const held = Number(rental.deposit_held || 0);
  const refunded = Number(rental.deposit_refunded_amount || 0);
  const forfeited = Number(rental.deposit_forfeited_amount || 0);
  const available = Math.max(0, held - refunded - forfeited);

  if (deductionAmount <= 0) {
    throw new Error("Enter a deduction amount.");
  }
  if (deductionAmount > available) {
    throw new Error("Deduction cannot exceed the remaining deposit held.");
  }

  const nextForfeited = forfeited + deductionAmount;
  const nextStatus = depositStatusFor(held, refunded, nextForfeited);
  const reasonText = notes ? `${reason} — ${notes}` : reason;
  const now = new Date().toISOString();

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .insert({
      organization_id: organizationId,
      vehicle_id: rental.vehicle_id,
      rental_id: rentalId,
      customer_id: rental.customer_id,
      type: "deposit_forfeited",
      amount: deductionAmount,
      currency: rental.currency || "THB",
      transaction_date: now.slice(0, 10),
      notes: `Deposit deduction: ${reasonText}`,
      metadata: { description: "Deposit deduction", reason, notes },
      is_deposit: false,
      deposit_rental_id: rentalId,
      created_by: user.id
    })
    .select("id")
    .single();

  if (transactionError) {
    throw new Error(transactionError.message);
  }

  const { error: rentalError } = await supabase
    .from("rentals")
    .update({
      deposit_forfeited_amount: nextForfeited,
      deposit_deduction_reason: reasonText,
      deposit_status: nextStatus,
      deposit_reconciled_at: nextForfeited + refunded >= held ? now : rental.deposit_reconciled_at,
      deposit_reconciled_by: nextForfeited + refunded >= held ? user.id : rental.deposit_reconciled_by
    })
    .eq("id", rentalId)
    .eq("organization_id", organizationId);

  if (rentalError) {
    throw new Error(rentalError.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rentalId,
    vehicle_id: rental.vehicle_id,
    rental_id: rentalId,
    customer_id: rental.customer_id,
    event_type: "deposit_deduction_applied",
    title: "Deposit deduction applied",
    detail: `Deposit deduction of ${money(deductionAmount)} applied — ${reason}.`,
    metadata: { transaction_id: transaction.id, amount: deductionAmount, reason, notes }
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rentalId}`);
}
