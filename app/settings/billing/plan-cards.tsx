"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui";
import { DIRECTORY_ADDON_MONTHLY, PLANS, YEARLY_MONTHS, yearlyPrice, type Plan } from "@/lib/plans";

type Say = (key: string, values?: Record<string, string | number>) => string;

const baht = (value: number) => `฿${value.toLocaleString("en-US")}`;

/** What a plan has that the one below it doesn't: the lines on its card. */
function differences(plan: Plan, say: Say): string[] {
  const lines: string[] = [];
  lines.push(plan.team === null ? say("pl_teamUnlimited") : say("pl_team", { count: plan.team }));
  lines.push(plan.documentReads === null ? say("pl_readsUnlimited") : say("pl_reads", { count: plan.documentReads }));
  lines.push(plan.comparisonLookups === null ? say("pl_lookupsUnlimited") : say("pl_lookups", { count: plan.comparisonLookups }));
  if (plan.accountingExport) lines.push(say("pl_export"));
  if (plan.ownersStatements) lines.push(say("pl_owners"));
  if (plan.severalLocations) lines.push(say("pl_locations"));
  if (plan.whiteLabel) lines.push(say("pl_whiteLabel"));
  if (plan.customDomain) lines.push(say("pl_ownDomain"));
  lines.push(plan.directoryIncluded ? say("pl_directoryIn") : say("pl_directoryAddon", { price: baht(DIRECTORY_ADDON_MONTHLY) }));
  if (plan.setupService) lines.push(say("pl_setup"));
  if (plan.prioritySupport) lines.push(say("pl_support"));
  return lines;
}

export function PlanCards({ currentTier, vehicles }: { currentTier: string; vehicles: number }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [yearly, setYearly] = useState(false);

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

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {PLANS.map((plan) => {
          const current = plan.id === currentTier;
          const popular = plan.id === "growth";
          const fits = plan.vehicles === null || vehicles <= plan.vehicles;
          const price = yearly ? yearlyPrice(plan) : plan.monthly;
          return (
            <section
              className={`card flex min-w-0 flex-col p-4 ${current ? "ring-2 ring-[var(--primary)]" : popular ? "ring-1 ring-[var(--primary)]/40" : ""}`}
              key={plan.id}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[18px] font-bold leading-tight text-[var(--foreground)]">{say(`bl_${plan.id}`)}</p>
                  <p className="mt-0.5 text-sm font-semibold text-[var(--foreground-secondary)]">
                    {plan.vehicles === null ? say("pl_vehiclesMore", { count: PLANS[3].vehicles! + 1 }) : say("pl_vehiclesUpTo", { count: plan.vehicles })}
                  </p>
                </div>
                {current ? <Badge tone="blue">{say("bl_currentBadge")}</Badge> : popular ? <Badge tone="green">{say("pl_popular")}</Badge> : null}
              </div>

              <p className="mt-4 text-[30px] font-bold leading-none text-[var(--foreground)]">
                {plan.monthly === 0 ? say("pl_free") : baht(price)}
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--muted)]">
                {plan.monthly === 0
                  ? say("pl_forever")
                  : plan.perVehicle
                    ? yearly
                      ? say("pl_perVehicleYear")
                      : say("pl_perVehicleMonth")
                    : yearly
                      ? say("pl_perYear", { monthly: baht(Math.round(price / 12)) })
                      : say("bl_perMonth")}
              </p>

              <ul className="mt-4 space-y-1.5 text-sm font-medium text-[var(--foreground)]">
                {differences(plan, say).map((line) => (
                  <li className="flex items-start gap-2" key={line}>
                    <Check className="mt-0.5 shrink-0 text-[var(--success)]" size={15} />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{line}</span>
                  </li>
                ))}
              </ul>

              {!current && !fits ? <p className="mt-3 text-sm font-semibold text-[var(--muted)]">{say("pl_tooSmall", { count: vehicles })}</p> : null}
            </section>
          );
        })}
      </div>

      <p className="mt-3 text-sm font-medium text-[var(--foreground-secondary)]">{say("pl_founding")}</p>
    </div>
  );
}
