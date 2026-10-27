"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentMembership } from "@/lib/auth/roles";
import { said } from "@/lib/i18n/server-text";
import { numberLocale } from "@/lib/i18n/dates";
import { notifyOperator } from "@/lib/notify-operator";
import { getVehicleCategories } from "@/lib/organization";
import { formatPlanPrice, planCharge } from "@/lib/plan-currency";
import { FOUNDING_SLOTS, PLANS, changeWaitsForRenewal, fleetMix, planById, type PlanId } from "@/lib/plans";
import { alertTeam, isPlatformAdmin } from "@/lib/support";
import { logAdminAction } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Choosing a plan (27 Oct 2026). There is no payment provider yet, so:
 * - Free switches straight away (after the trial, if one is running).
 * - A paid plan is a request: the plans page shows what to pay (PromptPay QR or
 *   transfer), a Help conversation is opened for the slip, and the RouteHQ team
 *   switches the plan on when the money arrives (`activatePlanRequest`).
 * Moving to a cheaper plan while paid up waits for the renewal date.
 */

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
type Interval = "monthly" | "yearly";

const ORG_FIELDS =
  "id, name, currency, subscription_status, subscription_tier, billing_interval, trial_ends_at, next_payment_due, subscription_started_at, pending_plan, pending_interval, plan_request_thread_id, founding_member";

async function foundingAvailable(admin: any, organization: { founding_member?: boolean | null }) {
  if (organization.founding_member) return true;
  const { count } = await admin.from("organizations").select("id", { count: "exact", head: true }).eq("founding_member", true);
  return (count || 0) < FOUNDING_SLOTS;
}

async function fleetOf(admin: any, organizationId: string) {
  const [{ data: rows }, categories] = await Promise.all([
    admin.from("vehicles").select("category_id").eq("organization_id", organizationId).is("deleted_at", null),
    getVehicleCategories(organizationId)
  ]);
  return fleetMix((rows || []) as Array<{ category_id: string | null }>, categories);
}

function trialRunning(organization: { subscription_status?: string | null; trial_ends_at?: string | null }) {
  return (organization.subscription_status || "trial") === "trial" && (!organization.trial_ends_at || new Date(organization.trial_ends_at).getTime() > Date.now());
}

function paidUp(organization: { subscription_status?: string | null; subscription_tier?: string | null; next_payment_due?: string | null }) {
  return organization.subscription_status === "active" && planById(organization.subscription_tier).monthly > 0 && Boolean(organization.next_payment_due) && new Date(String(organization.next_payment_due)).getTime() > Date.now();
}

export async function choosePlan(input: { plan: string; interval: string }): Promise<Result<{ outcome: "free" | "freeAfterTrial" | "pay" | "atRenewal" | "same" }>> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in first.") };
  if (membership.role !== "owner") return { ok: false, error: await said("Only the business owner can change this.") };
  const wanted = PLANS.find((plan) => plan.id === input.plan);
  if (!wanted) return { ok: false, error: await said("Could not send. Please try again.") };
  const interval: Interval = input.interval === "yearly" ? "yearly" : "monthly";
  const admin = createSupabaseAdminClient() as any;
  const { data: organization } = await admin.from("organizations").select(ORG_FIELDS).eq("id", membership.organizationId).maybeSingle();
  if (!organization) return { ok: false, error: await said("Could not send. Please try again.") };
  const current = planById(organization.subscription_tier);
  const clearPending = { pending_plan: null, pending_interval: null, pending_amount: null, pending_currency: null, plan_requested_at: null, plan_request_thread_id: null };

  if (wanted.id === "free") {
    const trial = trialRunning(organization);
    const update: Record<string, unknown> = { subscription_tier: "free", billing_interval: "monthly", ...clearPending };
    if (!trial) Object.assign(update, { subscription_status: "active", next_payment_due: null, subscription_started_at: organization.subscription_started_at || new Date().toISOString() });
    const { error } = await admin.from("organizations").update(update).eq("id", organization.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/settings/billing");
    return { ok: true, outcome: trial ? "freeAfterTrial" : "free" };
  }

  if (organization.subscription_status === "active" && current.id === wanted.id && (organization.billing_interval || "monthly") === interval) {
    if (organization.pending_plan) await admin.from("organizations").update(clearPending).eq("id", organization.id);
    revalidatePath("/settings/billing");
    return { ok: true, outcome: "same" };
  }

  const fleet = await fleetOf(admin, organization.id);
  const founding = await foundingAvailable(admin, organization);
  const charge = planCharge(wanted, fleet, organization.currency || "THB", interval, founding);
  // Paid up and moving down: nothing to pay now; the change waits for the renewal date.
  const atRenewal = paidUp(organization) && changeWaitsForRenewal({ id: current.id, interval: organization.billing_interval || "monthly" }, { id: wanted.id, interval });

  const [t, locale] = await Promise.all([getTranslations("settingsPage"), getLocale()]);
  const say = t as unknown as (key: string, values?: Record<string, string | number>) => string;
  const amountText = formatPlanPrice(charge.amount, charge.currency, numberLocale(locale));
  const body = say("pl_requestMsg", {
    plan: say(`bl_${wanted.id}`),
    interval: say(interval === "yearly" ? "pl_intervalYearly" : "pl_intervalMonthly"),
    amount: amountText
  });

  // One conversation per request: a second choice goes into the same one.
  let threadId: string | null = organization.plan_request_thread_id || null;
  if (threadId) {
    const { data: thread } = await admin.from("support_threads").select("id, status").eq("id", threadId).maybeSingle();
    if (!thread) threadId = null;
  }
  const now = new Date().toISOString();
  if (threadId) {
    await admin.from("support_messages").insert({ thread_id: threadId, organization_id: organization.id, author_id: membership.userId, from_team: false, body, attachments: [] });
    await admin.from("support_threads").update({ last_message_at: now, status: "open", unread_by_team: true }).eq("id", threadId);
  } else {
    const { data: thread, error } = await admin
      .from("support_threads")
      .insert({ organization_id: organization.id, created_by: membership.userId, topic: "billing", subject: say("pl_requestSubject", { plan: say(`bl_${wanted.id}`) }), status: "open", unread_by_team: true, unread_by_business: false })
      .select("id")
      .single();
    if (error || !thread) return { ok: false, error: error?.message || (await said("Could not send. Please try again.")) };
    threadId = thread.id;
    await admin.from("support_messages").insert({ thread_id: threadId, organization_id: organization.id, author_id: membership.userId, from_team: false, body, attachments: [] });
  }

  const update: Record<string, unknown> = {
    pending_plan: wanted.id,
    pending_interval: interval,
    pending_amount: charge.amount,
    pending_currency: charge.currency,
    plan_requested_at: now,
    plan_request_thread_id: threadId
  };
  // During the trial the choice is the plan they will be on; it shows as theirs straight away.
  if (trialRunning(organization)) update.subscription_tier = wanted.id;
  const { error } = await admin.from("organizations").update(update).eq("id", organization.id);
  if (error) return { ok: false, error: error.message };

  await alertTeam(`${organization.name || "A business"} chose ${wanted.id} (${interval}) · ${charge.currency} ${charge.amount}${charge.founding ? " founding" : ""}${atRenewal ? " · at renewal" : ""}`, String(threadId));
  revalidatePath("/settings/billing");
  revalidatePath("/help");
  return { ok: true, outcome: atRenewal ? "atRenewal" : "pay" };
}

/** The business changes its mind before the plan is switched on. */
export async function cancelPlanRequest(): Promise<Result> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in first.") };
  if (membership.role !== "owner") return { ok: false, error: await said("Only the business owner can change this.") };
  const admin = createSupabaseAdminClient() as any;
  const { data: organization } = await admin.from("organizations").select(ORG_FIELDS).eq("id", membership.organizationId).maybeSingle();
  if (!organization?.pending_plan) return { ok: true };
  const update: Record<string, unknown> = { pending_plan: null, pending_interval: null, pending_amount: null, pending_currency: null, plan_requested_at: null, plan_request_thread_id: null };
  const { error } = await admin.from("organizations").update(update).eq("id", organization.id);
  if (error) return { ok: false, error: error.message };
  if (organization.plan_request_thread_id) {
    await admin.from("support_threads").update({ status: "closed" }).eq("id", organization.plan_request_thread_id);
    await alertTeam(`${organization.name || "A business"} cancelled its plan change`, organization.plan_request_thread_id);
  }
  revalidatePath("/settings/billing");
  return { ok: true };
}

function addInterval(from: Date, interval: Interval) {
  const next = new Date(from);
  if (interval === "yearly") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

/**
 * RouteHQ team: the payment arrived, switch the plan on. Paid time runs from the later of today and the
 * current due date, so paying early never loses days.
 */
export async function activatePlanRequest(input: { organizationId: string }): Promise<Result> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in first.") };
  const supabase = (await createSupabaseServerClient()) as any;
  if (!(await isPlatformAdmin(supabase, membership.userId))) return { ok: false, error: await said("This conversation was not found.") };
  const admin = createSupabaseAdminClient() as any;
  const { data: organization } = await admin.from("organizations").select(ORG_FIELDS).eq("id", input.organizationId).maybeSingle();
  if (!organization?.pending_plan) return { ok: false, error: await said("This conversation was not found.") };
  const interval: Interval = organization.pending_interval === "yearly" ? "yearly" : "monthly";
  const due = organization.next_payment_due ? new Date(organization.next_payment_due) : null;
  const start = due && due.getTime() > Date.now() ? due : new Date();
  const founding = await foundingAvailable(admin, organization);
  const plan = organization.pending_plan as PlanId;
  const { error } = await admin
    .from("organizations")
    .update({
      subscription_tier: plan,
      billing_interval: interval,
      subscription_status: "active",
      subscription_started_at: organization.subscription_started_at || new Date().toISOString(),
      next_payment_due: addInterval(start, interval).toISOString(),
      founding_member: founding,
      pending_plan: null,
      pending_interval: null,
      pending_amount: null,
      pending_currency: null,
      plan_requested_at: null,
      plan_request_thread_id: null
    })
    .eq("id", organization.id);
  if (error) return { ok: false, error: error.message };
  if (organization.plan_request_thread_id) {
    await admin.from("support_threads").update({ status: "closed", unread_by_team: false }).eq("id", organization.plan_request_thread_id);
  }
  await logAdminAction(
    { userId: membership.userId, email: membership.email ?? null },
    { action: "plan_activated", organizationId: organization.id, details: { plan, interval, founding } }
  );
  await notifyOperator(organization.id, `✅ Your RouteHQ plan is now ${plan.charAt(0).toUpperCase()}${plan.slice(1)}`, "plan_activated", "/settings/billing");
  revalidatePath("/settings/billing");
  if (organization.plan_request_thread_id) revalidatePath(`/help/team/${organization.plan_request_thread_id}`);
  return { ok: true };
}
