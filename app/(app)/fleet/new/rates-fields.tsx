"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { InfoTip } from "@/components/info-tip";
import { MoneyInput } from "@/components/money-input";
import { formatMoney } from "@/lib/regional";

const labelClass = "font-semibold text-[var(--foreground-secondary)]";

/**
 * Prices for a new vehicle. Optional (Rory, 31 Oct 2026): a vehicle with no price stays off the online booking
 * page, and a new booking asks for the price. Any one will do; the others are worked out from it.
 */
export function RatesFields({ currency, usualDeposit = 0 }: { currency: string; usualDeposit?: number }) {
  const say = useTranslations("vehicleForm") as unknown as (key: string, values?: Record<string, string | number>) => string;
  const [rates, setRates] = useState({ dailyRate: "", weeklyRate: "", monthlyRate: "" });
  const cardRef = useRef<HTMLDivElement>(null);
  const set = (key: keyof typeof rates) => (digits: string) => setRates((current) => ({ ...current, [key]: digits }));

  return (
    <div className="card p-4" ref={cardRef}>
      <h2 className="card-title flex items-center gap-1.5">
        {say("ratesTitle")}
        <InfoTip label={say("ratesTitle")} text={say("ratesBody")} />
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={labelClass}>{say("daily")}</span>
          <MoneyInput currency={currency} name="dailyRate" onValueChange={set("dailyRate")} />
        </label>
        <label className="block">
          <span className={labelClass}>{say("weekly")}</span>
          <MoneyInput currency={currency} name="weeklyRate" onValueChange={set("weeklyRate")} />
        </label>
        <label className="block">
          <span className={labelClass}>{say("monthly")}</span>
          <MoneyInput currency={currency} name="monthlyRate" onValueChange={set("monthlyRate")} />
        </label>
      </div>
      <label className="mt-4 block sm:max-w-xs">
        <span className={`${labelClass} inline-flex items-center gap-1.5`}>
          {say("deposit")}
          <InfoTip label={say("deposit")} text={usualDeposit > 0 ? say("depositHintUsual", { amount: formatMoney(usualDeposit, currency, "en-US") }) : say("depositHintNone")} />
        </span>
        <MoneyInput currency={currency} name="depositAmount" />
      </label>
    </div>
  );
}
