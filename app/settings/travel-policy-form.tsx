"use client";

import Link from "next/link";
import { useState } from "react";
import { updateTravelPolicySettings } from "@/app/actions/settings";
import { PendingButton } from "@/components/pending-button";
import { jurisdictionByCountry, type TravelPolicySettings } from "@/lib/travel-policy";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(18,184,200,0.16)]";

const countries = [
  "Thailand",
  "Indonesia",
  "Philippines",
  "Malaysia",
  "Singapore",
  "Vietnam",
  "Australia",
  "United Kingdom",
  "Other"
];

const policyOptions = [
  {
    value: "deposit_required",
    title: "Secondary deposit required",
    body: "Customer pays an additional deposit before taking the vehicle to another island."
  },
  {
    value: "notice_only",
    title: "Notice only",
    body: "Customer must notify before inter-island travel, but no additional deposit is required."
  },
  {
    value: "not_permitted",
    title: "Not permitted",
    body: "Vehicle may not leave the home island or territory."
  }
];

export function TravelPolicyForm({
  organizationId,
  settings
}: {
  organizationId: string;
  settings: TravelPolicySettings;
}) {
  const [country, setCountry] = useState(settings.country);
  const [jurisdiction, setJurisdiction] = useState(settings.jurisdiction);
  const [territoryType, setTerritoryType] = useState(settings.home_territory_type);
  const [travelPolicy, setTravelPolicy] = useState(settings.island_travel_policy);

  function updateCountry(nextCountry: string) {
    setCountry(nextCountry);
    if (nextCountry !== "Other") {
      setJurisdiction(jurisdictionByCountry[nextCountry] || "");
    }
  }

  return (
    <form action={updateTravelPolicySettings} className="mt-3 space-y-3">
      <input name="organizationId" type="hidden" value={organizationId} />

      <section className="form-section bg-[var(--primary-light)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0f766e]">Business location</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Home territory</span>
            <input className={inputClass} defaultValue={settings.home_territory} name="homeTerritory" placeholder="Koh Samui" required />
            <span className="mt-1 block text-xs text-[#667085]">This appears in travel clauses and becomes your default operating area.</span>
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Country</span>
            <select className={inputClass} name="country" onChange={(event) => updateCountry(event.target.value)} value={country}>
              {countries.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            { value: "island", label: "Island", helper: "Island mode enables the ferry/boat travel clause in contracts." },
            { value: "mainland", label: "Mainland region", helper: "Mainland mode permits general travel. Island crossings still require notice." }
          ].map((option) => (
            <label
              className={`block rounded-lg border p-3 ${territoryType === option.value ? "border-[var(--primary)] bg-white shadow-[0_12px_26px_rgba(18,184,200,0.12)]" : "border-[var(--border)] bg-white"}`}
              key={option.value}
            >
              <input
                checked={territoryType === option.value}
                className="sr-only"
                name="homeTerritoryType"
                onChange={() => setTerritoryType(option.value as "island" | "mainland")}
                type="radio"
                value={option.value}
              />
              <span className="font-black text-[#10252b]">{option.label}</span>
              <span className="mt-1 block text-xs text-[#667085]">{option.helper}</span>
            </label>
          ))}
        </div>

        <label className="mt-3 block">
          <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Jurisdiction</span>
          <input className={inputClass} name="jurisdiction" onChange={(event) => setJurisdiction(event.target.value)} required value={jurisdiction} />
          <span className="mt-1 block text-xs text-[#667085]">This wording appears verbatim in the governing law clause.</span>
        </label>
      </section>

      <section className="form-section bg-[var(--primary-blue-light)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0f766e]">Inter-island travel policy</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {policyOptions.map((option) => (
            <label
              className={`block rounded-lg border p-3 ${travelPolicy === option.value ? "border-[var(--primary)] bg-white shadow-[0_12px_26px_rgba(18,184,200,0.12)]" : "border-[var(--border)] bg-white"}`}
              key={option.value}
            >
              <input
                checked={travelPolicy === option.value}
                className="sr-only"
                name="islandTravelPolicy"
                onChange={() => setTravelPolicy(option.value as TravelPolicySettings["island_travel_policy"])}
                type="radio"
                value={option.value}
              />
              <span className="font-black text-[#10252b]">{option.title}</span>
              <span className="mt-1 block text-xs leading-5 text-[#667085]">{option.body}</span>
            </label>
          ))}
        </div>
        {travelPolicy === "deposit_required" ? (
          <label className="mt-3 block max-w-sm">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Secondary deposit amount (THB)</span>
            <input className={inputClass} defaultValue={settings.secondary_deposit_amount} min="0" name="secondaryDepositAmount" type="number" />
          </label>
        ) : (
          <input name="secondaryDepositAmount" type="hidden" value={settings.secondary_deposit_amount} />
        )}
        <label className="checkbox-label sub-surface mt-4 p-3">
          <input className="flex-shrink-0" defaultChecked={settings.geofence_monitoring_enabled} name="geofenceMonitoringEnabled" type="checkbox" />
          <span>
            <span className="block font-black text-[#10252b]">GPS/geofence monitoring enabled</span>
            <span className="mt-1 block text-xs text-[#667085]">Adds the GPS monitoring clause when enabled.</span>
          </span>
        </label>
      </section>

      <details className="form-section bg-[var(--warning-light)]" open>
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0f766e]">Contract terms</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField defaultValue={settings.mileage_limit} label="Monthly mileage limit (km)" name="mileageLimit" />
          <NumberField defaultValue={settings.fuel_charge_per_increment} label="Fuel charge per 1/8 gauge increment (THB)" name="fuelChargePerIncrement" />
          <NumberField defaultValue={settings.late_fee_percentage} label="Late return fee (% per day)" name="lateFeePercentage" />
          <NumberField defaultValue={settings.cleaning_fee_minimum} label="Minimum cleaning fee (THB)" name="cleaningFeeMinimum" />
          <NumberField defaultValue={settings.smoking_fee_maximum} label="Maximum smoking penalty (THB)" name="smokingFeeMaximum" />
          <NumberField defaultValue={settings.emergency_repair_limit} label="Emergency repair authorisation limit (THB)" name="emergencyRepairLimit" />
          <NumberField defaultValue={settings.deposit_return_days} label="Deposit return period (business days)" name="depositReturnDays" />
        </div>
      </details>

      <section className="form-section bg-[var(--success-light)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0f766e]">Contact details for contracts</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">LINE ID</span>
            <input className={inputClass} defaultValue={settings.owner_line_id} name="ownerLineId" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">WhatsApp number</span>
            <input className={inputClass} defaultValue={settings.owner_whatsapp} name="ownerWhatsapp" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">PromptPay ID</span>
            <input className={inputClass} defaultValue={settings.promptpay_id} name="promptpayId" />
          </label>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <PendingButton className="primary-action flex-1" pendingLabel="Saving..." type="submit">
          Save travel policy
        </PendingButton>
        <Link className="secondary-action pressable flex-1 text-[var(--primary)]" href="/settings/contracts">
          Preview contract template
        </Link>
      </div>
    </form>
  );
}

function NumberField({ defaultValue, label, name }: { defaultValue: number; label: string; name: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">{label}</span>
      <input className={inputClass} defaultValue={defaultValue} min="0" name={name} type="number" />
    </label>
  );
}
