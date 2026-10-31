import type { Route } from "next";
import { Check } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BackLink, Badge } from "@/components/ui";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { dateFormat, numberLocale } from "@/lib/i18n/dates";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { formatPlanPrice } from "@/lib/plan-currency";
import { changeWaitsForRenewal, effectiveLimits, fleetMix, fleetText, planById, planForFleet, vehiclesOverLimit } from "@/lib/plans";
import { getCustomPlan } from "@/lib/custom-plan";
import { promptPayQrSvg } from "@/lib/promptpay";
import { PendingPlan } from "./pending-plan";
import { supportContacts } from "@/lib/support";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

export default async function BillingPage() {
  const [userEmail, baseOrganization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const t = await getTranslations("settingsPage");
  const say = t as unknown as Say;
  const supabase = (await createSupabaseServerClient()) as any;
  const [{ data: organization }, { data: vehicleRows }, categories] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "subscription_status, subscription_tier, billing_interval, trial_started_at, trial_ends_at, subscription_started_at, next_payment_due, payment_method, currency, pending_plan, pending_interval, pending_amount, pending_currency, plan_request_thread_id"
      )
      .eq("id", baseOrganization.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("vehicles").select("category_id").eq("organization_id", baseOrganization.id).is("deleted_at", null),
    getVehicleCategories(baseOrganization.id)
  ]);
  const [membership, locale, customPlan] = await Promise.all([getCurrentMembership(), getLocale(), getCustomPlan(baseOrganization.id)]);
  const canChange = membership?.role === "owner";
  const numbers = numberLocale(locale);
  const longDate = (value: string) => dateFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));

  const trialDays = daysUntil(organization?.trial_ends_at);
  const contacts = supportContacts();
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

  // A plan chosen and not yet switched on: what to pay, and how.
  const pendingPlan = organization?.pending_plan ? planById(organization.pending_plan) : null;
  let pending: Parameters<typeof PendingPlan>[0] | null = null;
  if (pendingPlan && organization) {
    const pendingInterval = organization.pending_interval === "yearly" ? "yearly" : "monthly";
    const pendingCurrency = String(organization.pending_currency || currency);
    const amount = Number(organization.pending_amount || 0);
    const paidUp = status === "active" && plan.monthly > 0 && organization.next_payment_due && new Date(organization.next_payment_due).getTime() > Date.now();
    const atRenewal = Boolean(paidUp) && changeWaitsForRenewal({ id: plan.id, interval }, { id: pendingPlan.id, interval: pendingInterval });
    const promptPayId = String(process.env.ROUTEHQ_PROMPTPAY_ID || "");
    const amountText = formatPlanPrice(amount, pendingCurrency, numbers);
    pending = {
      what: say("pl_pendingWhat", {
        plan: say(`bl_${pendingPlan.id}`),
        interval: say(pendingInterval === "yearly" ? "pl_intervalYearly" : "pl_intervalMonthly"),
        amount: amountText
      }),
      amount: amountText,
      qrSvg: pendingCurrency === "THB" && promptPayId && !atRenewal ? await promptPayQrSvg(promptPayId, amount) : null,
      bankDetails: String(process.env.ROUTEHQ_BANK_DETAILS || "").trim() || null,
      currency: pendingCurrency,
      renewalDate: atRenewal ? longDate(organization.next_payment_due) : null,
      threadId: organization.plan_request_thread_id || null,
      canChange
    };
  }
  const choseAfterTrial = status === "trial" ? (pendingPlan ? pendingPlan.id : plan.id === "free" ? "free" : null) : null;

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
        {status === "active" && plan.monthly > 0 && organization?.next_payment_due ? (
          <p className="mt-3 font-medium text-[var(--foreground-secondary)]">
            {say("pl_paidUntil", { date: longDate(organization.next_payment_due), interval: say(interval === "yearly" ? "pl_intervalYearly" : "pl_intervalMonthly") })}
          </p>
        ) : null}
        {isOver ? (
          <p className="mt-3 rounded-xl bg-[var(--warning-light)] px-4 py-3 font-medium text-[var(--foreground)]">
            {say("pl_over", { fleet: fleetText(over, say), plan: say(`bl_${suggested.id}`) })}
          </p>
        ) : null}
      </section>

      {pending ? <PendingPlan {...pending} /> : null}

      {/* The plans straight after your own plan; what every plan includes comes after them. */}
      <div className="card mt-3 p-4">
        <PlanCards
          canChange={canChange}
          currency={currency}
          currentInterval={interval}
          currentTier={plan.id}
          fleet={fleet}
          pendingPlan={pendingPlan?.id || null}
          status={status}
          suggestedTier={suggested.id}
        />
      </div>

      <section className="card mt-3 p-4">
        <h2 className="card-title">{say("pl_everyTitle")}</h2>
        <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("pl_everyBody")}</p>
        <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {INCLUDED.map((key) => (
            <li className="flex items-start gap-2 font-medium text-[var(--foreground)]" key={key}>
              <Check className="mt-1 shrink-0 text-[var(--success)]" size={16} />
              <span>{say(`inc_${key}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mt-3 p-4">
        <h2 className="card-title">{say("bl_howTitle")}</h2>
        <p className="measure mt-1 font-medium text-[var(--foreground-secondary)]">{say("bl_howBody")}</p>
        {/* Support channels come from the environment so no placeholder number or address ships.
            All secondary: the way to pay starts from a plan's Choose button above. */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link className="secondary-action pressable" href={"/help?topic=billing" as Route}>
            {say("bl_help")}
          </Link>
          {contacts.lineUrl ? (
            <a className="secondary-action pressable" href={contacts.lineUrl} rel="noreferrer" target="_blank">
              {say("bl_line")}
            </a>
          ) : null}
          {contacts.whatsappUrl ? (
            <a className="secondary-action pressable" href={contacts.whatsappUrl} rel="noreferrer" target="_blank">
              {say("bl_whatsapp")}
            </a>
          ) : null}
          {contacts.email ? (
            <a className="secondary-action pressable" href={`mailto:${contacts.email}?subject=${encodeURIComponent("RoveHQ subscription")}`}>
              {say("bl_email")}
            </a>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
