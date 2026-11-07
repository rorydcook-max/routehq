import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui";
import { dateFormat, numberLocale } from "@/lib/i18n/dates";
import { formatPlanPrice } from "@/lib/plan-currency";
import { effectiveLimits, planById } from "@/lib/plans";
import { getBillingDetails } from "@/lib/billing/details";
import { loadFleet } from "@/lib/billing/parking";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BillingActions, PortalButton } from "./billing-actions";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * The plan's facts (price and interval, renewal or end date, payment method, billing address, invoices) and its
 * buttons, on the Plan tab and the Plan and subscription page. Facts Stripe doesn't have are left out.
 */
export async function BillingSummary({ organizationId, canChange, showChangePlan, customLimits }: { organizationId: string; canChange: boolean; showChangePlan: boolean; customLimits?: unknown }) {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: organization } = await supabase
    .from("organizations")
    .select(
      "subscription_status, subscription_tier, billing_interval, trial_ends_at, next_payment_due, stripe_customer_id, stripe_subscription_id, subscription_cancel_at_period_end, scheduled_plan, scheduled_interval, scheduled_change_at"
    )
    .eq("id", organizationId)
    .maybeSingle();
  if (!organization) return null;
  const [t, locale, details, fleet] = await Promise.all([getTranslations("settingsPage"), getLocale(), getBillingDetails(organization), canChange ? loadFleet(supabase, organizationId) : Promise.resolve([])]);
  const say = t as unknown as Say;
  const longDate = (value: string) => dateFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
  const shortDate = (value: string) => dateFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  const numbers = numberLocale(locale);

  const status = String(organization.subscription_status || "trial");
  const plan = planById(organization.subscription_tier);
  const subscribed = Boolean(organization.stripe_subscription_id);
  const ending = Boolean(organization.subscription_cancel_at_period_end);
  const due = organization.next_payment_due as string | null;

  const facts: Array<{ label: string; value: string }> = [];
  if (details?.amount !== null && details?.amount !== undefined && details.currency) {
    const amount = formatPlanPrice(details.amount, details.currency, numbers);
    facts.push({ label: say("sb_price"), value: say(details.interval === "yearly" ? "sb_perYear" : "sb_perMonth", { amount }) });
  }
  if (subscribed && due) {
    facts.push({ label: say(ending ? "sb_ends" : status === "trial" ? "sb_firstPayment" : "sb_renews"), value: longDate(due) });
  } else if (status === "trial" && organization.trial_ends_at) {
    facts.push({ label: say("plan_trialEnds"), value: longDate(organization.trial_ends_at) });
  }
  if (details?.card) facts.push({ label: say("sb_payment"), value: details.card.last4 ? say("sb_cardEnding", { brand: details.card.brand, last4: details.card.last4 }) : details.card.brand });
  if (details?.address.length) facts.push({ label: say("sb_address"), value: details.address.join(", ") });
  if (details?.taxId) facts.push({ label: say("sb_taxId"), value: details.taxId });

  const scheduled = organization.scheduled_plan && organization.scheduled_change_at ? { plan: String(organization.scheduled_plan), date: longDate(organization.scheduled_change_at) } : null;
  const freeLimits = effectiveLimits({ subscription_tier: "free", custom_limits: customLimits });
  const vehicles = fleet.map((vehicle) => ({ id: vehicle.id, label: vehicle.label, registration: vehicle.registration, motorbike: vehicle.motorbike, parked: vehicle.parked, busy: vehicle.busy }));
  const invoiceTone = (value: string) => (value === "paid" ? "green" : value === "open" ? "amber" : "neutral");

  return (
    <div>
      {status === "past_due" ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl bg-[var(--danger-light)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <p className="font-bold text-[var(--danger)]">{say("sb_pastDue")}</p>
          {canChange && organization.stripe_customer_id ? <PortalButton label={say("sb_updateCard")} primary /> : null}
        </div>
      ) : null}
      {scheduled ? (
        <p className="mt-4 rounded-xl bg-[var(--warning-light)] px-4 py-3 font-semibold text-[var(--foreground)]">
          {say("sb_movesTo", { plan: say(`bl_${planById(scheduled.plan).id}`), date: scheduled.date })}
        </p>
      ) : null}
      {facts.length ? (
        <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
          {facts.map((fact) => (
            <div className="flex items-baseline justify-between gap-3 sm:block" key={fact.label}>
              <dt className="text-[14px] font-semibold text-[var(--muted)]">{fact.label}</dt>
              <dd className="min-w-0 text-right font-semibold text-[var(--foreground)] [overflow-wrap:anywhere] sm:text-left">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {details?.invoices.length ? (
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <p className="text-[14px] font-semibold text-[var(--muted)]">{say("sb_invoices")}</p>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {details.invoices.map((invoice) => (
              <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2" key={invoice.id}>
                <span className="font-semibold text-[var(--foreground)]">{shortDate(invoice.date)}</span>
                <span className="num text-[var(--foreground-secondary)]">{formatPlanPrice(invoice.amount, invoice.currency, numbers)}</span>
                <Badge tone={invoiceTone(invoice.status) as any}>{t.has(`sb_inv_${invoice.status}` as never) ? say(`sb_inv_${invoice.status}`) : invoice.status}</Badge>
                <span className="ml-auto flex gap-3 text-sm font-bold">
                  {invoice.url ? (
                    <a className="text-[var(--primary)]" href={invoice.url} rel="noreferrer" target="_blank">
                      {say("sb_view")}
                    </a>
                  ) : null}
                  {invoice.pdf ? (
                    <a className="text-[var(--primary)]" href={invoice.pdf} rel="noreferrer" target="_blank">
                      {say("sb_pdf")}
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {canChange ? (
        <BillingActions
          canCancel={subscribed && plan.monthly > 0 && !ending && !scheduled}
          canKeep={Boolean(scheduled) && subscribed}
          cancelDate={due ? longDate(due) : null}
          freeLimits={{ cars: freeLimits.cars, motorbikes: freeLimits.motorbikes }}
          hasCustomer={Boolean(organization.stripe_customer_id)}
          keepLabel={say("sb_keepPlan", { plan: say(`bl_${plan.id}`) })}
          showChangePlan={showChangePlan}
          trial={status === "trial"}
          vehicles={vehicles}
        />
      ) : null}
    </div>
  );
}
