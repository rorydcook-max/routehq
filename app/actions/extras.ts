"use server";

import { revalidatePath } from "next/cache";
import { said } from "@/lib/i18n/server-text";
import { tellRentalCustomer } from "@/lib/customer-messages";
import { businessToday } from "@/lib/business-time";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { activeExtrasLines, extrasLines, extrasSummary, isExtrasPayment, isOpenPayment, isRentPayment, round } from "@/lib/extras";

type Result = { ok: true } | { ok: false; error: string };

/** Signed in, a member of the business, and the booking with its payments and money records. */
async function load(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const organizationId = String(formData.get("organizationId") || "").trim();
  const rentalId = String(formData.get("rentalId") || "").trim();
  if (!organizationId || !rentalId) throw new Error("Missing required fields.");
  const { data: member } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!member) throw new Error("You do not have access to this organization.");
  const [{ data: rental }, { data: payments }, { data: transactions }] = await Promise.all([
    supabase.from("rentals").select("id, organization_id, vehicle_id, customer_id, currency, extras, extras_total").eq("id", rentalId).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle(),
    supabase.from("rental_payments").select("*").eq("rental_id", rentalId).eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("transactions").select("id, amount, voided, metadata, deleted_at").eq("rental_id", rentalId).eq("organization_id", organizationId).is("deleted_at", null)
  ]);
  if (!rental) throw new Error("Booking not found.");
  return { supabase, user, organizationId, rentalId, rental, payments: (payments || []) as any[], transactions: (transactions || []) as any[] };
}

async function run(action: () => Promise<void>): Promise<Result> {
  try {
    await action();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: await said(error instanceof Error ? error.message : "Something went wrong.") };
  }
}

function amountFrom(formData: FormData) {
  return round(Number(String(formData.get("amount") || "0").replace(/,/g, "")));
}

function refresh(rentalId: string) {
  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/transactions");
  revalidatePath(`/bookings/${rentalId}`);
}

async function note(ctx: Awaited<ReturnType<typeof load>>, eventType: string, title: string, detail: string) {
  await recordActivityEvent(ctx.supabase, {
    organization_id: ctx.organizationId,
    actor_id: ctx.user.id,
    entity_type: "rental",
    entity_id: ctx.rentalId,
    vehicle_id: ctx.rental.vehicle_id,
    rental_id: ctx.rentalId,
    customer_id: ctx.rental.customer_id,
    event_type: eventType,
    title,
    detail
  });
}

async function closeJobs(supabase: any, organizationId: string, paymentIds: string[], why: string) {
  if (!paymentIds.length) return;
  await supabase
    .from("tasks")
    .update({ completed_at: new Date().toISOString(), completion_notes: why })
    .eq("organization_id", organizationId)
    .in("rental_payment_id", paymentIds)
    .is("completed_at", null);
}

/** Extras not paid yet go onto the next rent payment, and are paid with it. */
export async function moveExtrasToRent(formData: FormData): Promise<Result> {
  return run(async () => {
    const ctx = await load(formData);
    const open = ctx.payments.filter((row) => isExtrasPayment(row) && isOpenPayment(row));
    const amount = round(open.reduce((sum, row) => sum + Number(row.amount || 0), 0));
    if (amount <= 0) throw new Error("There are no unpaid extras to move.");
    const next = extrasSummary(ctx.rental, ctx.payments, ctx.transactions).nextRent;
    const rent = next ? ctx.payments.find((row) => row.id === next.id) : null;
    if (!rent) throw new Error("There is no rent payment still to come to add the extras to.");

    const names = activeExtrasLines(ctx.rental).map((line) => line.name);
    const included = rent.metadata?.includes_extras || {};
    const { error } = await ctx.supabase
      .from("rental_payments")
      .update({
        amount: round(Number(rent.amount || 0) + amount),
        metadata: { ...(rent.metadata || {}), includes_extras: { amount: round(Number(included.amount || 0) + amount), names } }
      })
      .eq("id", rent.id)
      .eq("organization_id", ctx.organizationId);
    if (error) throw new Error(error.message);
    for (const row of open) {
      await ctx.supabase
        .from("rental_payments")
        .update({ status: "cancelled", metadata: { ...(row.metadata || {}), moved_to_payment: rent.id, moved_at: new Date().toISOString() } })
        .eq("id", row.id)
        .eq("organization_id", ctx.organizationId);
    }
    await closeJobs(ctx.supabase, ctx.organizationId, open.map((row) => row.id), "Extras moved onto the next rent payment.");
    await note(ctx, "extras_moved", "Extras added to the next rent", `Extras of ${amount} ${ctx.rental.currency || "THB"} added to the rent due ${rent.due_date}.`);
    await tellRentalCustomer(createSupabaseAdminClient() as any, ctx.rentalId, ({ say, money, date }) => say("extrasMoved", { amount: money(amount), date: date(rent.due_date) }), {
      sentBy: ctx.user.id,
      withLink: true
    });
    refresh(ctx.rentalId);
  });
}

/**
 * Takes extras off the booking. What was not paid yet for them is no longer due;
 * anything already paid stays shown, to refund or take off the rent.
 */
export async function removeExtras(formData: FormData): Promise<Result> {
  return run(async () => {
    const ctx = await load(formData);
    let picked: number[] = [];
    try {
      picked = JSON.parse(String(formData.get("lines") || "[]")).map(Number);
    } catch {
      picked = [];
    }
    const all = extrasLines(ctx.rental);
    const chosen = all.map((line, index) => ({ line, index })).filter(({ line, index }) => !line.removed_at && picked.includes(index));
    if (!chosen.length) throw new Error("Choose the extras to take off.");
    const removing = round(chosen.reduce((sum, { line }) => sum + Number(line.amount || 0), 0));

    // Unpaid extras first from their own payment, then from rent they were moved onto.
    let left = removing;
    const touched: string[] = [];
    for (const row of ctx.payments.filter((item) => isExtrasPayment(item) && isOpenPayment(item))) {
      if (left <= 0) break;
      const value = Number(row.amount || 0);
      const take = Math.min(value, left);
      left = round(left - take);
      if (take >= value) touched.push(row.id);
      await ctx.supabase
        .from("rental_payments")
        .update(
          take >= value
            ? { status: "cancelled", metadata: { ...(row.metadata || {}), removed_extras: true } }
            : { amount: round(value - take), metadata: { ...(row.metadata || {}), removed_extras_amount: round(Number(row.metadata?.removed_extras_amount || 0) + take) } }
        )
        .eq("id", row.id)
        .eq("organization_id", ctx.organizationId);
    }
    for (const row of ctx.payments.filter((item) => isRentPayment(item) && isOpenPayment(item) && Number(item.metadata?.includes_extras?.amount || 0) > 0)) {
      if (left <= 0) break;
      const included = Number(row.metadata.includes_extras.amount);
      const take = Math.min(included, left);
      left = round(left - take);
      await ctx.supabase
        .from("rental_payments")
        .update({
          amount: round(Math.max(0, Number(row.amount || 0) - take)),
          metadata: { ...(row.metadata || {}), includes_extras: { ...row.metadata.includes_extras, amount: round(included - take) } }
        })
        .eq("id", row.id)
        .eq("organization_id", ctx.organizationId);
    }

    const now = new Date().toISOString();
    const lines = all.map((line, index) => (chosen.some((item) => item.index === index) ? { ...line, removed_at: now } : line));
    await ctx.supabase
      .from("rentals")
      .update({ extras: lines, extras_total: round(Math.max(0, Number(ctx.rental.extras_total || 0) - removing)) })
      .eq("id", ctx.rentalId)
      .eq("organization_id", ctx.organizationId);
    await closeJobs(ctx.supabase, ctx.organizationId, touched, "Extras taken off the booking.");
    const names = chosen.map(({ line }) => line.name).join(", ");
    await note(ctx, "extras_removed", "Extras taken off", `${names} taken off the booking.`);
    await tellRentalCustomer(createSupabaseAdminClient() as any, ctx.rentalId, ({ say }) => say("extrasRemoved", { names }), { sentBy: ctx.user.id, withLink: true });
    refresh(ctx.rentalId);
  });
}

/** Gives back money paid for extras, as a refund of extras only. */
export async function refundExtras(formData: FormData): Promise<Result> {
  return run(async () => {
    const ctx = await load(formData);
    const amount = amountFrom(formData);
    const { available } = extrasSummary(ctx.rental, ctx.payments, ctx.transactions);
    if (amount <= 0) throw new Error("Enter a refund amount greater than zero.");
    if (amount > available + 0.5) throw new Error("That is more than was paid for extras.");
    const method = String(formData.get("paymentMethod") || "");
    const notes = String(formData.get("notes") || "").trim();
    const { error } = await ctx.supabase.from("transactions").insert({
      organization_id: ctx.organizationId,
      vehicle_id: ctx.rental.vehicle_id,
      rental_id: ctx.rentalId,
      customer_id: ctx.rental.customer_id,
      type: "refund",
      amount: -Math.abs(amount),
      currency: ctx.rental.currency || "THB",
      transaction_date: businessToday(),
      notes: notes || "Extras refund",
      metadata: {
        description: "Extras refund",
        refund_of: "extras",
        notes,
        created_by_operator: true,
        ...(["cash", "bank_transfer", "promptpay"].includes(method) ? { payment_method: method } : {})
      },
      is_deposit: false,
      created_by: ctx.user.id
    });
    if (error) throw new Error(error.message);
    await note(ctx, "payment_refunded", "Extras refunded", `Extras refund of ${amount} ${ctx.rental.currency || "THB"} recorded.${notes ? ` Notes: ${notes}` : ""}`);
    await tellRentalCustomer(createSupabaseAdminClient() as any, ctx.rentalId, ({ say, money }) => say("extrasRefunded", { amount: money(amount) }), { sentBy: ctx.user.id, withLink: false });
    refresh(ctx.rentalId);
  });
}

/** Money paid for extras counts towards the rent still to come instead of going back in cash. */
export async function creditExtrasToRent(formData: FormData): Promise<Result> {
  return run(async () => {
    const ctx = await load(formData);
    const amount = amountFrom(formData);
    const summary = extrasSummary(ctx.rental, ctx.payments, ctx.transactions);
    if (amount <= 0) throw new Error("Enter an amount greater than zero.");
    if (amount > summary.available + 0.5) throw new Error("That is more than was paid for extras.");
    const rents = ctx.payments
      .filter((row) => isRentPayment(row) && isOpenPayment(row))
      .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")));
    if (!rents.length) throw new Error("There is no rent payment still to come to take it off.");
    if (rents.reduce((sum, row) => sum + Number(row.amount || 0), 0) + 0.5 < amount) throw new Error("The rent still to come is less than that amount.");

    let left = amount;
    const firstDue = String(rents[0].due_date || "");
    for (const row of rents) {
      if (left <= 0) break;
      const value = Number(row.amount || 0);
      const take = Math.min(value, left);
      if (take <= 0) continue;
      left = round(left - take);
      const metadata = { ...(row.metadata || {}), extras_credit: round(Number(row.metadata?.extras_credit || 0) + take) };
      // Fully covered: the rent is settled by the credit, with nothing more to collect.
      await ctx.supabase
        .from("rental_payments")
        .update(
          take >= value
            ? { status: "paid", paid_at: new Date().toISOString(), paid_date: businessToday(), metadata: { ...metadata, settled_by_extras_credit: true } }
            : { amount: round(value - take), metadata }
        )
        .eq("id", row.id)
        .eq("organization_id", ctx.organizationId);
    }
    await note(ctx, "extras_credited", "Extras taken off the rent", `${amount} ${ctx.rental.currency || "THB"} paid for extras taken off the rent due ${firstDue}.`);
    await tellRentalCustomer(createSupabaseAdminClient() as any, ctx.rentalId, ({ say, money, date }) => say("extrasCredited", { amount: money(amount), date: date(firstDue) }), {
      sentBy: ctx.user.id,
      withLink: true
    });
    refresh(ctx.rentalId);
  });
}
