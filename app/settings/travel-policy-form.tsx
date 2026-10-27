"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { updateTravelPolicySettings } from "@/app/actions/settings";
import { PendingButton } from "@/components/pending-button";
import { feeOn, jurisdictionByCountry, type FeeKey, type TravelPolicySettings } from "@/lib/travel-policy";
import { SwitchField } from "@/components/switch-field";
import { displayNamesLocale } from "@/lib/i18n/dates";

type Say = (key: string, values?: Record<string, string | number>) => string;
const labelClass = "font-semibold text-[var(--foreground-secondary)]";
const helpClass = "mt-1 block font-medium text-[var(--muted)]";
const headingClass = "text-[16px] font-bold text-[var(--foreground)]";

// Stored in English (the agreement wording keys off it); shown in the account language.
const countries: Array<{ value: string; code: string | null }> = [
  { value: "Thailand", code: "TH" },
  { value: "Indonesia", code: "ID" },
  { value: "Philippines", code: "PH" },
  { value: "Malaysia", code: "MY" },
  { value: "Singapore", code: "SG" },
  { value: "Vietnam", code: "VN" },
  { value: "Australia", code: "AU" },
  { value: "United Kingdom", code: "GB" },
  { value: "Other", code: null }
];

const policyOptions = ["deposit_required", "notice_only", "not_permitted"] as const;

export function TravelPolicyForm({ organizationId, settings }: { organizationId: string; settings: TravelPolicySettings }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const locale = useLocale();
  const [country, setCountry] = useState(settings.country);
  const [jurisdiction, setJurisdiction] = useState(settings.jurisdiction);
  const [territoryType, setTerritoryType] = useState(settings.home_territory_type);
  const [travelPolicy, setTravelPolicy] = useState(settings.island_travel_policy);

  const countryName = (entry: { value: string; code: string | null }) => {
    if (!entry.code) return say("tp_other");
    try {
      return new Intl.DisplayNames([displayNamesLocale(locale)], { type: "region" }).of(entry.code) || entry.value;
    } catch {
      return entry.value;
    }
  };

  function updateCountry(nextCountry: string) {
    setCountry(nextCountry);
    if (nextCountry !== "Other") {
      setJurisdiction(jurisdictionByCountry[nextCountry] || "");
    }
  }

  const choiceClass = (selected: boolean) => `block cursor-pointer rounded-xl p-3.5 ${selected ? "bg-[var(--primary-light)] ring-2 ring-[var(--primary)]" : "bg-[var(--panel-secondary)]"}`;

  return (
    <form action={updateTravelPolicySettings} className="mt-3 space-y-5">
      <input name="organizationId" type="hidden" value={organizationId} />
      {/* The choices travel in these two fields. The form is cleared after each save, which unticks the round buttons underneath. */}
      <input name="homeTerritoryType" type="hidden" value={territoryType} />
      <input name="islandTravelPolicy" type="hidden" value={travelPolicy} />

      <section>
        <p className={headingClass}>{say("tp_based")}</p>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>{say("tp_home")}</span>
            <input className="mt-1 w-full" defaultValue={settings.home_territory} name="homeTerritory" placeholder="Koh Samui" required />
            <span className={helpClass}>{say("tp_homeHelp")}</span>
          </label>
          <label className="block">
            <span className={labelClass}>{say("tp_country")}</span>
            <select className="mt-1 w-full" name="country" onChange={(event) => updateCountry(event.target.value)} value={country}>
              {countries.map((item) => (
                <option key={item.value} value={item.value}>
                  {countryName(item)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {(["island", "mainland"] as const).map((option) => (
            <label className={choiceClass(territoryType === option)} key={option}>
              <input checked={territoryType === option} className="sr-only" name="homeTerritoryTypeChoice" onChange={() => setTerritoryType(option)} type="radio" value={option} />
              <span className="block font-bold text-[var(--foreground)]">{say(`tp_${option}`)}</span>
              <span className="mt-0.5 block font-medium text-[var(--foreground-secondary)]">{say(`tp_${option}Help`)}</span>
            </label>
          ))}
        </div>

        <label className="mt-3 block">
          <span className={labelClass}>{say("tp_law")}</span>
          <input className="mt-1 w-full" name="jurisdiction" onChange={(event) => setJurisdiction(event.target.value)} required value={jurisdiction} />
          <span className={helpClass}>{say("tp_lawHelp")}</span>
        </label>
      </section>

      <section>
        <p className={headingClass}>{say("tp_leaving")}</p>
        <div className="mt-2.5 grid gap-2.5 lg:grid-cols-3">
          {policyOptions.map((option) => (
            <label className={choiceClass(travelPolicy === option)} key={option}>
              <input checked={travelPolicy === option} className="sr-only" name="islandTravelPolicyChoice" onChange={() => setTravelPolicy(option as TravelPolicySettings["island_travel_policy"])} type="radio" value={option} />
              <span className="block font-bold text-[var(--foreground)]">{say(`tp_${option}`)}</span>
              <span className="mt-0.5 block font-medium text-[var(--foreground-secondary)]">{say(`tp_${option}Body`)}</span>
            </label>
          ))}
        </div>
        {travelPolicy === "deposit_required" ? (
          <label className="mt-3 block max-w-sm">
            <span className={labelClass}>{say("tp_extraDeposit")}</span>
            <input className="mt-1 w-full" defaultValue={settings.secondary_deposit_amount} inputMode="numeric" min="0" name="secondaryDepositAmount" step="0.01" type="number" />
          </label>
        ) : (
          <input name="secondaryDepositAmount" type="hidden" value={settings.secondary_deposit_amount} />
        )}
        <SwitchField
          className="mt-3"
          defaultChecked={settings.geofence_monitoring_enabled}
          description={say("tp_gpsHelp")}
          label={say("tp_gps")}
          labelClassName="font-bold text-[var(--foreground)]"
          name="geofenceMonitoringEnabled"
        />
      </section>

      <section>
        <p className={headingClass}>{say("tp_fees")}</p>
        <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{say("tp_feesHelp")}</p>
        {/* One row per fee: switch and name on the left, amount on the right, so every box lines up
            however long the name is in each language (Rory, 27 Oct). Off = left out of the agreement. */}
        <div className="mt-2.5 grid gap-2">
          {FEES.map((fee) => (
            <FeeRow
              defaultValue={settings[fee.key]}
              key={fee.key}
              label={say(fee.label)}
              name={fee.name}
              offText={say(`tp_off_${fee.key}`)}
              on={feeOn(settings, fee.key)}
              onName={`feeOn_${fee.key}`}
              step={fee.step}
            />
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <PendingButton className="primary-action" pendingLabel={say("saving")} savedLabel={say("saved")} type="submit">
          {say("save")}
        </PendingButton>
        <Link className="secondary-action pressable" href="/settings/contracts">
          {say("tp_seeWording")}
        </Link>
      </div>
    </form>
  );
}

const FEES: Array<{ key: FeeKey; name: string; label: string; step: string }> = [
  { key: "mileage_limit", name: "mileageLimit", label: "tp_km", step: "1" },
  { key: "fuel_charge_per_increment", name: "fuelChargePerIncrement", label: "tp_fuel", step: "0.01" },
  { key: "late_fee_percentage", name: "lateFeePercentage", label: "tp_late", step: "0.01" },
  { key: "cleaning_fee_minimum", name: "cleaningFeeMinimum", label: "tp_cleaning", step: "0.01" },
  { key: "smoking_fee_maximum", name: "smokingFeeMaximum", label: "tp_smoking", step: "0.01" },
  { key: "emergency_repair_limit", name: "emergencyRepairLimit", label: "tp_repairs", step: "0.01" },
  { key: "deposit_return_days", name: "depositReturnDays", label: "tp_depositDays", step: "1" }
];

/** A fee or limit with its own switch. Switched off, the amount is kept (hidden) for when it comes back on. */
function FeeRow({ defaultValue, label, name, on: initialOn, onName, offText, step }: { defaultValue: number; label: string; name: string; on: boolean; onName: string; offText: string; step: string }) {
  const [on, setOn] = useState(initialOn);
  const [value, setValue] = useState(String(defaultValue));
  return (
    <div className="flex min-h-[60px] items-center justify-between gap-3 rounded-xl bg-[var(--panel-secondary)] px-3.5 py-2.5">
      <label className="flex min-w-0 cursor-pointer items-start gap-3">
        <input checked={on} className="switch" name={onName} onChange={(event) => setOn(event.target.checked)} role="switch" type="checkbox" value="on" />
        <span className="min-w-0 font-semibold leading-6 text-[var(--foreground)]">{label}</span>
      </label>
      {on ? (
        <input
          aria-label={label}
          className="w-28 shrink-0 text-end"
          inputMode="decimal"
          min="0"
          name={name}
          onChange={(event) => setValue(event.target.value)}
          required
          step={step}
          type="number"
          value={value}
        />
      ) : (
        <>
          <span className="shrink-0 text-end font-semibold text-[var(--muted)]">{offText}</span>
          <input name={name} type="hidden" value={value} />
        </>
      )}
    </div>
  );
}
