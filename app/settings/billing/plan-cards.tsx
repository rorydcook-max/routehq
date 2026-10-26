"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui";
import { numberLocale } from "@/lib/i18n/dates";
import { BUSINESS_INCLUDED, PLANS, YEARLY_MONTHS, businessExtras, fleetText, overBy, type FleetMix, type Plan } from "@/lib/plans";
import { fleetMonthly, formatPlanPrice, planCurrency, planPrices, yearlyOf } from "@/lib/plan-currency";

type Say = (key: string, values?: Record<string, string | number>) => string;

/** What a plan has: the lines on its card. */
function differences(plan: Plan, say: Say, number: (value: number) => string): string[] {
  const lines: string[] = [];
  lines.push(plan.team === null ? say("pl_teamUnlimited") : say("pl_team", { count: plan.team }));
  lines.push(say("pl_reads", { count: number(plan.documentReads) }));
  lines.push(say("pl_lookups", { count: number(plan.comparisonLookups) }));
  if (plan.accountingExport) lines.push(say("pl_export"));
  if (plan.severalLocations) lines.push(say("pl_locations"));
  if (plan.whiteLabel) lines.push(say("pl_whiteLabel"));
  if (plan.customDomain) lines.push(say("pl_ownDomain"));
  if (plan.setupService) lines.push(say("pl_setup"));
  if (plan.prioritySupport) lines.push(say("pl_support"));
  return lines;
}

export function PlanCards({ currentTier, fleet, currency: rawCurrency }: { currentTier: string; fleet: FleetMix; currency: string }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const locale = useLocale();
  const [yearly, setYearly] = useState(false);
  const currency = planCurrency(rawCurrency);
  const price = (amount: number) => formatPlanPrice(amount, currency, numberLocale(locale));
  const period = (monthly: number) => (yearly ? yearlyOf(monthly, currency) : monthly);
  const hasFleet = fleet.cars + fleet.motorbikes > 0;
  /** A yearly price as "a month": whole units, or cents below 20 ($13.75). */
  const perMonthOfYear = (yearlyAmount: number) => {
    const value = yearlyAmount / 12;
    return value >= 20 ? Math.round(value) : Math.round(value * 100) / 100;
  };

  return (
    <div>
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h2 className="text-[20px] font-bold text-[var(--foreground)]">{say("pl_choose")}</h2>
        <div className="inline-flex rounded-full border border-[var(--border)] bg-white p-1" role="group">
          <button
            aria-pressed={!yearly}
            className={`pressable rounded-full px-4 py-2 text-sm font-bold ${!yearly ? "bg-[var(--primary)] text-white" : "text-[var(--foreground-secondary)]"}`}
            onClick={() => setYearly(false)}
            type="button"
          >
            {say("pl_monthly")}
          </button>
          <button
            aria-pressed={yearly}
            className={`pressable rounded-full px-4 py-2 text-sm font-bold ${yearly ? "bg-[var(--primary)] text-white" : "text-[var(--foreground-secondary)]"}`}
            onClick={() => setYearly(true)}
            type="button"
          >
            {say("pl_yearly")} <span className={yearly ? "opacity-90" : "text-[var(--success)]"}>· {say("pl_monthsFree", { count: 12 - YEARLY_MONTHS })}</span>
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const current = plan.id === currentTier;
          const popular = plan.id === "pro";
          const over = overBy(plan, fleet);
          const fits = over.cars === 0 && over.motorbikes === 0;
          const prices = planPrices(plan, currency);
          const business = plan.id === "business";
          const extras = businessExtras(fleet);
          // Only worth a line once the fleet is past what the base price covers.
          const yourFleet = business && hasFleet && extras.cars + extras.motorbikes > 0 ? fleetMonthly(plan, fleet, currency) : null;
          return (
            <section
              className={`card flex min-w-0 flex-col p-4 ${current ? "ring-2 ring-[var(--primary)]" : popular ? "ring-1 ring-[var(--primary)]/40" : ""}`}
              key={plan.id}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[18px] font-bold leading-tight text-[var(--foreground)]">{say(`bl_${plan.id}`)}</p>
                  <p className="mt-0.5 text-sm font-semibold text-[var(--foreground-secondary)]">
                    {business ? say("pl_anySize") : say("pl_upTo", { fleet: fleetText({ cars: plan.cars!, motorbikes: plan.motorbikes! }, say) })}
                  </p>
                </div>
                {current ? <Badge tone="blue">{say("bl_currentBadge")}</Badge> : popular ? <Badge tone="green">{say("pl_popular")}</Badge> : null}
              </div>

              <p className="mt-4 text-[30px] font-bold leading-none text-[var(--foreground)]">
                {plan.monthly === 0 ? say("pl_free") : price(period(prices.monthly))}
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--muted)]">
                {plan.monthly === 0
                  ? say("pl_forever")
                  : yearly
                    ? say("pl_perYear", { monthly: price(perMonthOfYear(period(prices.monthly))) })
                    : say("bl_perMonth")}
              </p>
              {business ? (
                <p className="mt-2 text-sm font-medium text-[var(--foreground-secondary)]">
                  {say("pl_businessIncludes", { fleet: fleetText(BUSINESS_INCLUDED, say) })}{" "}
                  {say("pl_businessExtra", { car: price(period(prices.extraCar)), motorbike: price(period(prices.extraMotorbike)) })}
                </p>
              ) : null}
              {yourFleet !== null ? (
                <p className="mt-2 rounded-lg bg-[var(--primary-light)] px-3 py-2 text-sm font-bold text-[var(--foreground)]">
                  {say("pl_forYourFleet", { amount: price(period(yourFleet)) })}
                </p>
              ) : null}

              <ul className="mt-4 space-y-1.5 text-sm font-medium text-[var(--foreground)]">
                {differences(plan, say, (value) => value.toLocaleString(numberLocale(locale))).map((line) => (
                  <li className="flex items-start gap-2" key={line}>
                    <Check className="mt-0.5 shrink-0 text-[var(--success)]" size={15} />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{line}</span>
                  </li>
                ))}
              </ul>

              {!current && !fits ? <p className="mt-3 text-sm font-semibold text-[var(--muted)]">{say("pl_tooSmall")}</p> : null}
            </section>
          );
        })}
      </div>

      <p className="mt-3 text-sm font-medium text-[var(--foreground-secondary)]">
        {say("pl_bikesNote")}
        {currency !== "THB" ? ` ${say("pl_currencyNote", { currency })}` : ""}
      </p>
      <p className="mt-1 text-sm font-medium text-[var(--foreground-secondary)]">{say("pl_founding")}</p>
    </div>
  );
}
