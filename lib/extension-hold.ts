import { randomBytes } from "node:crypto";
import { addDaysIso, bookingRules, EXTENSION_ASK_DAYS, EXTENSION_LAPSE_DAYS } from "@/lib/booking-rules";
import { remindRentalCustomerOnce } from "@/lib/customer-messages";
import { notifyOperator } from "@/lib/notify-operator";
import type { AlertText } from "@/lib/operator-alert-text";
import { processCustomerPortalAction } from "@/lib/portal-notifications";
import { BLOCKING_RENTAL_STATUSES, OUT_RENTAL_STATUSES } from "@/lib/rental-conflicts";

/**
 * Hold for extension (Rory, 7 Nov 2026): Settings > Holds and notice > "Hold for extension".
 *
 * The hold itself is worked out in the database (supabase/migrations/0125_extension_hold.sql): a monthly rental
 * (monthly rate or billing, or 28+ days) of a business with the setting on gets rentals.extension_hold_until =
 * end date + N days, which every customer-facing availability check reads through bookableEnd (lib/rental-conflicts.ts).
 * Recording an answer for the current end date (returning, released by the owner, or lapsed) lifts it at once.
 *
 * This file does the rest:
 *   - runExtensionHolds: the daily job at the business's reminder hour. 7 days before the end the renter gets one
 *     "Are you extending?" message with a link to /book/extend/<token>; with no answer by 2 days before, the hold lifts.
 *   - answerExtensionCheck: the renter's Extend (goes into the normal extension request flow: applied on the spot when
 *     free, else a To do for the owner) or Returning (hold lifts, owner gets a To do and an alert).
 *   - releaseHold: the owner lets the dates go by hand.
 */

export type ExtensionAnswer = "extend" | "returning" | "released" | "lapsed";

const iso = (value: unknown) => (value ? String(value).slice(0, 10) : null);

function appBase() {
  return String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

export function extensionCheckUrl(token: string) {
  return `${appBase()}/book/extend/${token}`;
}

/** Records an answer (or a release or lapse) for the rental's current end date. The hold is re-worked by the database. */
async function recordAnswer(admin: any, rentalId: string, endDate: string, answer: ExtensionAnswer) {
  const { error } = await admin
    .from("rentals")
    .update({ extension_check_end: endDate, extension_answer: answer, extension_answered_at: answer === "lapsed" ? null : new Date().toISOString() })
    .eq("id", rentalId)
    .eq("end_date", endDate);
  return !error;
}

/**
 * The daily part, for businesses at their reminder hour (app/api/cron/payment-status), on their own date `today`.
 * Lifts unanswered holds 2 days before the end, then asks renters whose held rental ends in 3 to 7 days (normally
 * exactly 7; later only if the question couldn't go out on the day). Each question goes once per end date.
 */
export async function runExtensionHolds(admin: any, organizationIds: string[], today: string): Promise<{ asked: number; lapsed: number }> {
  const result = { asked: 0, lapsed: 0 };
  if (!organizationIds.length) return result;
  const { data: organizations } = await admin.from("organizations").select("id, settings").in("id", organizationIds);
  const on = ((organizations || []) as any[]).filter((organization) => bookingRules(organization.settings).extensionHold).map((organization) => String(organization.id));
  if (!on.length) return result;

  // ── No answer by 2 days before the end: the hold lifts ───────────────────
  const { data: lapsing } = await admin
    .from("rentals")
    .select("id, end_date, extension_check_end, extension_answer")
    .in("organization_id", on)
    .is("deleted_at", null)
    .not("extension_hold_until", "is", null)
    .lte("end_date", addDaysIso(today, EXTENSION_LAPSE_DAYS));
  for (const row of (lapsing || []) as any[]) {
    const end = iso(row.end_date);
    if (!end) continue;
    // They said they're extending: the hold stays while the owner sorts it out.
    if (iso(row.extension_check_end) === end && row.extension_answer === "extend") continue;
    if (await recordAnswer(admin, row.id, end, "lapsed")) result.lapsed += 1;
  }

  // ── A week before the end: "Are you extending?" ──────────────────────────
  const { data: ending } = await admin
    .from("rentals")
    .select("id, end_date, extension_check_end, extension_check_token")
    .in("organization_id", on)
    .is("deleted_at", null)
    .in("status", OUT_RENTAL_STATUSES as unknown as string[])
    .not("extension_hold_until", "is", null)
    .gte("end_date", addDaysIso(today, EXTENSION_LAPSE_DAYS + 1))
    .lte("end_date", addDaysIso(today, EXTENSION_ASK_DAYS));
  for (const row of (ending || []) as any[]) {
    const end = iso(row.end_date);
    // Already asked (or answered, or released) for this end date.
    if (!end || iso(row.extension_check_end) === end) continue;
    let token = String(row.extension_check_token || "");
    if (!token) {
      token = randomBytes(18).toString("base64url");
      const { error } = await admin.from("rentals").update({ extension_check_token: token }).eq("id", row.id).is("extension_check_token", null);
      if (error) continue;
    }
    const link = extensionCheckUrl(token);
    const sent = await remindRentalCustomerOnce(admin, row.id, `extend-check:${end}`, ({ say, vehicle, date }) => say("extendCheck", { vehicle, date: date(end), link }), { withLink: false });
    if (!sent) continue;
    await admin
      .from("rentals")
      .update({ extension_check_end: end, extension_check_sent_at: new Date().toISOString(), extension_answer: null, extension_answered_at: null })
      .eq("id", row.id)
      .eq("end_date", end);
    result.asked += 1;
  }
  return result;
}

export type ExtensionCheck =
  | { state: "not_found" }
  | {
      state: "open" | "closed" | "answered" | "extended";
      rentalId: string;
      organizationId: string;
      businessName: string;
      brandColour: string | null;
      contactPhone: string | null;
      vehicle: string;
      endDate: string;
      answer: ExtensionAnswer | null;
    };

/** The rental behind an "Are you extending?" link, for the customer page. */
export async function loadExtensionCheck(admin: any, token: string): Promise<ExtensionCheck> {
  if (!token || token.length < 16) return { state: "not_found" };
  const { data: rental } = await admin
    .from("rentals")
    .select(
      "id, organization_id, status, end_date, extension_check_end, extension_answer, vehicles!rentals_vehicle_id_fkey(make, model), organizations!rentals_organization_id_fkey(name, trading_name, business_phone, whatsapp, contract_accent_colour)"
    )
    .eq("extension_check_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (!rental) return { state: "not_found" };
  const organization = rental.organizations || {};
  const end = iso(rental.end_date);
  const checkEnd = iso(rental.extension_check_end);
  const answeredNow = checkEnd === end ? (rental.extension_answer as ExtensionAnswer | null) : null;
  // They said Extend and the end date has since moved on (applied at once, or by the owner): nothing to answer now.
  const extendedSince = rental.extension_answer === "extend" && !!checkEnd && !!end && checkEnd < end;
  const live = (BLOCKING_RENTAL_STATUSES as readonly string[]).includes(String(rental.status || "")) && !!end;
  return {
    state: !live ? "closed" : extendedSince ? "extended" : answeredNow === "extend" || answeredNow === "returning" ? "answered" : "open",
    rentalId: rental.id,
    organizationId: rental.organization_id,
    businessName: String(organization.trading_name || organization.name || ""),
    brandColour: organization.contract_accent_colour || null,
    contactPhone: organization.whatsapp || organization.business_phone || null,
    vehicle: [rental.vehicles?.make, rental.vehicles?.model].filter(Boolean).join(" "),
    endDate: end || "",
    answer: answeredNow
  };
}

export type AnswerOutcome = { ok: true; answer: "extend" | "returning"; extendedTo?: string | null } | { ok: false; error: "not_found" | "closed" | "date" | "failed" };

/**
 * The renter's answer. Extend goes into the normal extension request flow (lib/portal-notifications.ts): applied at
 * once when nothing is in the way (which sends its own notice), otherwise a To do and an alert for the owner.
 * Returning lifts the hold, and the owner gets a "Confirmed return" To do and an alert.
 */
export async function answerExtensionCheck(admin: any, input: { token: string; answer: "extend" | "returning"; newEndDate?: string | null }): Promise<AnswerOutcome> {
  const check = await loadExtensionCheck(admin, input.token);
  if (check.state === "not_found") return { ok: false, error: "not_found" };
  if (check.state !== "open") return { ok: false, error: "closed" };
  const { data: rental } = await admin.from("rentals").select("id, customer_id").eq("id", check.rentalId).maybeSingle();
  if (!rental) return { ok: false, error: "not_found" };

  if (input.answer === "returning") {
    if (!(await recordAnswer(admin, check.rentalId, check.endDate, "returning"))) return { ok: false, error: "failed" };
    const { data: action } = await admin
      .from("customer_portal_actions")
      .insert({
        organisation_id: check.organizationId,
        rental_id: check.rentalId,
        customer_id: rental.customer_id,
        action_type: "return_confirmation",
        content: { return_date: check.endDate, note: "Not extending (answered the extension check)" },
        status: "pending"
      })
      .select("id")
      .single();
    if (action?.id) await processCustomerPortalAction(admin, action.id).catch(() => null);
    const message: AlertText = { emoji: "✅", key: "extensionHoldReturning", values: { customer: await customerName(admin, rental.customer_id), vehicle: check.vehicle || null }, dates: { date: check.endDate } };
    await notifyOperator(check.organizationId, message, "portal_action", `/bookings/${check.rentalId}`).catch(() => null);
    return { ok: true, answer: "returning" };
  }

  const newEnd = iso(input.newEndDate);
  if (!newEnd || newEnd <= check.endDate) return { ok: false, error: "date" };
  if (!(await recordAnswer(admin, check.rentalId, check.endDate, "extend"))) return { ok: false, error: "failed" };
  const { data: action, error } = await admin
    .from("customer_portal_actions")
    .insert({
      organisation_id: check.organizationId,
      rental_id: check.rentalId,
      customer_id: rental.customer_id,
      action_type: "extension_request",
      content: { new_end_date: newEnd, note: "Answered the extension check" },
      status: "pending"
    })
    .select("id")
    .single();
  if (error || !action?.id) return { ok: false, error: "failed" };
  const processed = await processCustomerPortalAction(admin, action.id).catch(() => null);
  const extension = processed?.extension || null;
  // An extension applied automatically sends its own notice (as on the booking page's own request form).
  if (!extension?.applied) {
    const message: AlertText = extension && !extension.applied ? { emoji: "📅", key: "extensionRequestedReason", values: { reason: extension.reason } } : { emoji: "📅", key: "extensionRequested" };
    await notifyOperator(check.organizationId, message, "portal_action", `/bookings/${check.rentalId}#customer-requests`).catch(() => null);
  }
  return { ok: true, answer: "extend", extendedTo: extension?.applied ? newEnd : null };
}

async function customerName(admin: any, customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await admin.from("customers").select("full_name").eq("id", customerId).maybeSingle();
  return data?.full_name ? String(data.full_name) : null;
}

/** The owner lets the held dates go (for the rental's current end date). */
export async function releaseHold(admin: any, organizationId: string, rentalId: string): Promise<boolean> {
  const { data: rental } = await admin.from("rentals").select("id, end_date").eq("id", rentalId).eq("organization_id", organizationId).maybeSingle();
  const end = iso(rental?.end_date);
  if (!rental || !end) return false;
  return recordAnswer(admin, rentalId, end, "released");
}
