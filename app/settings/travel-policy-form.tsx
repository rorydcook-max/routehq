"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { updateTravelPolicySettings } from "@/app/actions/settings";
import { PendingButton } from "@/components/pending-button";
import { jurisdictionByCountry, type TravelPolicySettings } from "@/lib/travel-policy";

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
      return new Intl.DisplayNames([locale], { type: "region" }).of(entry.code) || entry.value;
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
              <input checked={territoryType === option} className="sr-only" name="homeTerritoryType" onChange={() => setTerritoryType(option)} type="radio" value={option} />
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
              <input checked={travelPolicy === option} className="sr-only" name="islandTravelPolicy" onChange={() => setTravelPolicy(option as TravelPolicySettings["island_travel_policy"])} type="radio" value={option} />
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
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input className="mt-1 h-5 w-5 shrink-0" defaultChecked={settings.geofence_monitoring_enabled} name="geofenceMonitoringEnabled" type="checkbox" />
          <span>
            <span className="block font-bold text-[var(--foreground)]">{say("tp_gps")}</span>
            <span className="mt-0.5 block font-medium text-[var(--foreground-secondary)]">{say("tp_gpsHelp")}</span>
          </span>
        </label>
      </section>

      <section>
        <p className={headingClass}>{say("tp_fees")}</p>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField defaultValue={settings.mileage_limit} label={say("tp_km")} name="mileageLimit" />
          <NumberField defaultValue={settings.fuel_charge_per_increment} label={say("tp_fuel")} name="fuelChargePerIncrement" step="0.01" />
          <NumberField defaultValue={settings.late_fee_percentage} label={say("tp_late")} name="lateFeePercentage" step="0.01" />
          <NumberField defaultValue={settings.cleaning_fee_minimum} label={say("tp_cleaning")} name="cleaningFeeMinimum" step="0.01" />
          <NumberField defaultValue={settings.smoking_fee_maximum} label={say("tp_smoking")} name="smokingFeeMaximum" step="0.01" />
          <NumberField defaultValue={settings.emergency_repair_limit} label={say("tp_repairs")} name="emergencyRepairLimit" step="0.01" />
          <NumberField defaultValue={settings.deposit_return_days} label={say("tp_depositDays")} name="depositReturnDays" />
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

function NumberField({ defaultValue, label, name, step = "1" }: { defaultValue: number; label: string; name: string; step?: string }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input className="mt-1 w-full" defaultValue={defaultValue} inputMode="decimal" min="0" name={name} step={step} type="number" />
    </label>
  );
}
