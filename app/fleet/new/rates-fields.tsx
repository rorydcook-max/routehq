"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MoneyInput } from "@/components/money-input";

const labelClass = "font-semibold text-[var(--foreground-secondary)]";

/**
 * Prices for a new vehicle. At least one is needed: a vehicle saved with no
 * price at all could then be booked for nothing by mistake. Any one will do;
 * the others are worked out from it when a booking is made.
 */
export function RatesFields({ currency, usualDeposit = 0 }: { currency: string; usualDeposit?: number }) {
  const say = useTranslations("vehicleForm") as unknown as (key: string, values?: Record<string, string | number>) => string;
  const [rates, setRates] = useState({ dailyRate: "", weeklyRate: "", monthlyRate: "" });
  const [asked, setAsked] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasPrice = Object.values(rates).some((value) => Number(value) > 0);
  const set = (key: keyof typeof rates) => (digits: string) => setRates((current) => ({ ...current, [key]: digits }));

  return (
    <div className="card p-4" ref={cardRef}>
      <h2 className="text-[17px] font-bold text-[var(--foreground)]">{say("ratesTitle")}</h2>
      <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("ratesBody")}</p>
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
      {/* Stops the form being sent with no price, and brings this card into view to say why. */}
      <input
        aria-hidden="true"
        className="pointer-events-none absolute h-px w-px opacity-0"
        onChange={() => undefined}
        onInvalid={(event) => {
          event.preventDefault();
          setAsked(true);
          cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        required
        tabIndex={-1}
        value={hasPrice ? "ok" : ""}
      />
      {asked && !hasPrice ? <p className="mt-3 rounded-xl bg-[var(--warning-light)] p-3 font-semibold text-[var(--foreground)]">{say("needPrice")}</p> : null}
      <label className="mt-4 block sm:max-w-xs">
        <span className={labelClass}>{say("deposit")}</span>
        <MoneyInput currency={currency} name="depositAmount" />
        <span className="mt-1 block font-medium text-[var(--foreground-secondary)]">{usualDeposit > 0 ? say("depositHintUsual", { amount: `฿${usualDeposit.toLocaleString("en-US")}` }) : say("depositHintNone")}</span>
      </label>
    </div>
  );
}
