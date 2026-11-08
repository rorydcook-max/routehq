import { Check } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BackLink, Badge } from "@/components/ui";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { dateFormat } from "@/lib/i18n/dates";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { effectiveLimits, fleetMix, fleetText, planById, planForFleet, vehiclesOverLimit } from "@/lib/plans";
import { getCustomPlan } from "@/lib/custom-plan";
import { loadFleet } from "@/lib/billing/parking";
import { getStripe, stripeConfigured } from "@/lib/billing/stripe";
import { retrieveSubscription, syncSubscription } from "@/lib/billing/sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BillingSummary } from "./billing-summary";
import { PlanCards } from "./plan-cards";

type Say = (key: string, values?: Record<string, string | number>) => string;

// What every plan includes: the product, sold properly. Each key is an inc_* line.
const INCLUDED = [
  "bookings",
  "links",
  "forms",
  "payments",
  "extras",
  "seasons",
  "reminders",
  "inbox",
  "calendar",
  "reports",
  "online",
  "directory",
  "brand",
  "partners",
  "owners",
  "calculator",
  "languages",
  "phone"
];

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

/** Back from a Checkout redirect (some payment methods leave the page): put the new plan on before showing it. */
async function settleCheckout(sessionId: string | undefined, organizationId: string) {
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId) || !stripeConfigured()) return;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (session.client_reference_id !== organizationId || session.status !== "complete" || !subscriptionId) return;
    await syncSubscription(createSupabaseAdminClient() as any, await retrieveSubscription(subscriptionId));
  } catch {
    // The webhook brings it in shortly.
  }
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const [userEmail, baseOrganization, query] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), searchParams]);
  await settleCheckout(query.checkout, baseOrganization.id);
  const t = await getTranslations("settingsPage");
  const say = t as unknown as Say;
  const supabase = (await createSupabaseServerClient()) as any;
  const [{ data: organization }, { data: vehicleRows }, categories, allVehicles] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "subscription_status, subscription_tier, billing_interval, trial_started_at, trial_ends_at, subscription_started_at, next_payment_due, payment_method, currency, pending_plan, stripe_subscription_id, scheduled_plan, scheduled_change_at"
      )
      .eq("id", baseOrganization.id)
      .is("deleted_at", null)
      .maybeSingle(),
    // Parked vehicles don't count towards the plan.
    supabase.from("vehicles").select("category_id").eq("organization_id", baseOrganization.id).is("deleted_at", null).is("parked_at", null),
    getVehicleCategories(baseOrganization.id),
    loadFleet(supabase, baseOrganization.id)
  ]);
  const [membership, locale, customPlan] = await Promise.all([getCurrentMembership(), getLocale(), getCustomPlan(baseOrganization.id)]);
  const canChange = membership?.role === "owner";
  const longDate = (value: string) => dateFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));

  const trialDays = daysUntil(organization?.trial_ends_at);
  const plan = planById(organization?.subscription_tier);
  // What this business actually gets: the plan, with any custom limits RoveHQ set for it on top.
  const limits = effectiveLimits({ subscription_tier: organization?.subscription_tier, custom_limits: customPlan.custom_limits });
  // Free chosen during the trial: once the trial is over they are simply on Free.
  const rawStatus = String(organization?.subscription_status || "trial");
  const status = rawStatus === "trial" && plan.id === "free" && trialDays === 0 ? "active" : rawStatus;
  const fleet = fleetMix((vehicleRows || []) as Array<{ category_id: string | null }>, categories);
  const over = vehiclesOverLimit(limits, fleet, status);
  const isOver = over.cars + over.motorbikes > 0;
  const suggested = planForFleet(fleet);
  const currency = String(organization?.currency || "THB");
  const statusName = t.has(`bl_st_${status}` as never) ? say(`bl_st_${status}`) : status.replace(/_/g, " ");
  const interval = String(organization?.billing_interval || "monthly");

  // Plans are paid through Stripe (7 Nov 2026): a subscription, and maybe a smaller plan waiting for the renewal date.
  const subscribed = Boolean(organization?.stripe_subscription_id);
  const scheduledPlan = organization?.scheduled_plan ? planById(organization.scheduled_plan).id : null;
  const scheduledDate = organization?.scheduled_change_at ? longDate(organization.scheduled_change_at) : null;
  const parkedCount = allVehicles.filter((vehicle) => vehicle.parked).length;
  const choseAfterTrial = status === "trial" ? (subscribed || plan.id === "free" ? plan.id : null) : null;

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-4">
        <BackLink href="/settings?tab=more" label={say("title")} />
        <h1 className="page-title">{say("bl_title")}</h1>
        <p className="page-subtitle mt-1">{say("pl_subtitle")}</p>
      </div>

      <section className="card p-4">
        <p className="font-semibold text-[var(--muted)]">{say("bl_current")}</p>
        {/* Plan name and its status on one line. */}
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <p className="text-[22px] font-semibold leading-tight text-[var(--foreground)]">{say(`bl_${plan.id}`)}</p>
          <Badge tone={status === "active" ? "green" : status === "trial" ? "blue" : "red"}>{statusName}</Badge>
        </div>
        <p className="mt-1 font-medium text-[var(--foreground-secondary)]">
          {say("pl_fleetNow", { fleet: fleetText(fleet, say) })}
          {limits.cars !== null && limits.motorbikes !== null ? (
            <span className="block text-sm">{say("pl_planCovers", { fleet: fleetText({ cars: limits.cars, motorbikes: limits.motorbikes }, say) })}</span>
          ) : null}
        </p>
        {status === "trial" ? (
          <p className="mt-3 text-[17px] font-bold text-[var(--foreground)]">
            {trialDays === null ? say("bl_trialNoDate") : say("bl_trialLeft", { days: trialDays })}
            <span className="block text-sm font-medium text-[var(--foreground-secondary)]">
              {choseAfterTrial ? say("pl_afterTrial", { plan: say(`bl_${choseAfterTrial}`) }) : say("pl_trialAll", { plan: say(`bl_${suggested.id}`) })}
            </span>
          </p>
        ) : null}
        {!subscribed && status === "active" && plan.monthly > 0 && organization?.next_payment_due ? (
          <p className="mt-3 font-medium text-[var(--foreground-secondary)]">
            {say("pl_paidUntil", { date: longDate(organization.next_payment_due), interval: say(interval === "yearly" ? "pl_intervalYearly" : "pl_intervalMonthly") })}
          </p>
        ) : null}
        {parkedCount ? (
          <p className="mt-2">
            <Badge tone="neutral">{say("sb_parkedCount", { count: parkedCount })}</Badge>
          </p>
        ) : null}
        {isOver ? (
          <p className="mt-3 rounded-xl bg-[var(--warning-light)] px-4 py-3 font-medium text-[var(--foreground)]">
            {say("pl_over", { fleet: fleetText(over, say), plan: say(`bl_${suggested.id}`) })}
          </p>
        ) : null}
        <BillingSummary canChange={canChange} customLimits={customPlan.custom_limits} organizationId={baseOrganization.id} showChangePlan={false} />
      </section>

      {/* The plans straight after your own plan; what every plan includes comes after them. */}
      <div className="card mt-3 scroll-mt-24 p-4" id="plans">
        <PlanCards
          canChange={canChange}
          currency={currency}
          currentInterval={interval}
          currentTier={plan.id}
          customLimits={customPlan.custom_limits}
          fleet={fleet}
          pendingPlan={null}
          scheduledDate={scheduledDate}
          scheduledPlan={scheduledPlan}
          status={status}
          subscribed={subscribed}
          suggestedTier={suggested.id}
          vehicles={allVehicles.map((vehicle) => ({ id: vehicle.id, label: vehicle.label, registration: vehicle.registration, motorbike: vehicle.motorbike, parked: vehicle.parked, busy: vehicle.busy }))}
        />
      </div>

      <section className="card mt-3 p-4">
        <h2 className="card-title">{say("pl_everyTitle")}</h2>
        <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {INCLUDED.map((key) => (
            <li className="flex items-start gap-2 font-medium text-[var(--foreground)]" key={key}>
              <Check className="mt-1 shrink-0 text-[var(--success)]" size={16} />
              <span>{say(`inc_${key}`)}</span>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
