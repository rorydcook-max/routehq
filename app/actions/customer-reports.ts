"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/roles";
import { customerMatchKeys, REPORT_KINDS, type ReportKind } from "@/lib/customer-history";
import { said } from "@/lib/i18n/server-text";
import { isHandedOver } from "@/lib/rental-balances";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * "Warn other RoveHQ businesses": a report about a rental that ended badly. It needs a rental the vehicle actually
 * went out on, and something to recognise the person by (passport, licence or phone); the owner or a manager files it.
 */
export async function fileCustomerReport(formData: FormData): Promise<Result> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in first.") };
  if (!["owner", "manager"].includes(membership.role)) return { ok: false, error: await said("Only the owner or a manager can warn other businesses.") };
  const supabase = (await createSupabaseServerClient()) as any;
  const organizationId = membership.organizationId;
  const customerId = String(formData.get("customerId") || "");
  const rentalId = String(formData.get("rentalId") || "");
  const kind = String(formData.get("kind") || "") as ReportKind;
  const amountText = String(formData.get("amount") || "").replace(/[^\d.]/g, "");
  const amount = amountText ? Number(amountText) : null;
  const occurredOn = String(formData.get("occurredOn") || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  const notes = String(formData.get("notes") || "").trim().slice(0, 1000) || null;
  // What other businesses read, in the reporter's own words, under the business's name: enough to judge it by.
  const summary = String(formData.get("summary") || "").replace(/\s+/g, " ").trim().slice(0, 600);
  if (!REPORT_KINDS.includes(kind)) return { ok: false, error: await said("Choose what happened.") };
  if (summary.length < 20) return { ok: false, error: await said("Say what happened in a sentence or two. Other businesses read this to decide for themselves.") };
  if (String(formData.get("confirm") || "") !== "yes") return { ok: false, error: await said("Tick the box to confirm the report is true and can carry your business name.") };
  if (amount !== null && !(amount >= 0 && amount < 10_000_000)) return { ok: false, error: await said("Check the amount.") };

  const [{ data: customer }, { data: rental }] = await Promise.all([
    supabase.from("customers").select("id, phone, whatsapp_number, passport_number, driver_license_number").eq("id", customerId).eq("organization_id", organizationId).maybeSingle(),
    supabase.from("rentals").select("id, status, customer_id").eq("id", rentalId).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle()
  ]);
  if (!customer) return { ok: false, error: await said("This customer was not found.") };
  if (!rental || rental.customer_id !== customer.id) return { ok: false, error: await said("Choose one of this customer's rentals.") };
  // A report stands on a rental that really happened, not on a booking that never went out.
  if (!isHandedOver(rental.status)) return { ok: false, error: await said("Only rentals where the vehicle went out can be reported.") };
  const keys = customerMatchKeys(customer);
  if (!keys.length) return { ok: false, error: await said("Add the customer's passport, licence or phone first, so others can recognise them.") };

  const { error } = await supabase.from("customer_reports").insert({ organization_id: organizationId, customer_id: customer.id, rental_id: rental.id, kind, amount, occurred_on: occurredOn, notes, summary, match_keys: keys, created_by: membership.userId });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: false, error: await said("This rental already has a report of that kind.") };
    return { ok: false, error: error.message };
  }
  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: membership.userId,
    entity_type: "customer",
    entity_id: customer.id,
    customer_id: customer.id,
    rental_id: rental.id,
    event_type: "customer_reported",
    title: "Other businesses warned",
    detail: `Reported to other RoveHQ businesses: ${kind.replace(/_/g, " ")}${amount ? ` (฿${amount.toLocaleString("en-US")})` : ""}.`
  });
  revalidatePath(`/customers/${customer.id}`);
  return { ok: true };
}

/** Take a report back (paid up after all, or filed by mistake). Other businesses stop seeing it straight away. */
export async function withdrawCustomerReport(formData: FormData): Promise<Result> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in first.") };
  if (!["owner", "manager"].includes(membership.role)) return { ok: false, error: await said("Only the owner or a manager can change this.") };
  const supabase = (await createSupabaseServerClient()) as any;
  const id = String(formData.get("reportId") || "");
  const { data, error } = await supabase
    .from("customer_reports")
    .update({ withdrawn_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", membership.organizationId)
    .is("withdrawn_at", null)
    .select("customer_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || (await said("This report was not found.")) };
  revalidatePath(`/customers/${data.customer_id}`);
  return { ok: true };
}

/**
 * The customer put it right (paid in the end, damage sorted): the report stays, marked settled with how, so other
 * businesses see both the problem and that it was resolved. Settling can't be undone; withdraw is for mistakes.
 */
export async function settleCustomerReport(formData: FormData): Promise<Result> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in first.") };
  if (!["owner", "manager"].includes(membership.role)) return { ok: false, error: await said("Only the owner or a manager can change this.") };
  const supabase = (await createSupabaseServerClient()) as any;
  const id = String(formData.get("reportId") || "");
  const note = String(formData.get("note") || "").replace(/\s+/g, " ").trim().slice(0, 300) || null;
  const { data, error } = await supabase
    .from("customer_reports")
    .update({ settled_at: new Date().toISOString(), settled_note: note })
    .eq("id", id)
    .eq("organization_id", membership.organizationId)
    .is("withdrawn_at", null)
    .is("settled_at", null)
    .select("customer_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || (await said("This report was not found.")) };
  revalidatePath(`/customers/${data.customer_id}`);
  return { ok: true };
}
