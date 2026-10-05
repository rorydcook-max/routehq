"use client";

import Link from "next/link";
import { useState } from "react";
import { updateTravelPolicySettings } from "@/app/actions/settings";
import { PendingButton } from "@/components/pending-button";
import { jurisdictionByCountry, type TravelPolicySettings } from "@/lib/travel-policy";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(15,118,110,0.16)]";

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
    title: "Extra deposit",
    body: "The customer pays an extra deposit before going."
  },
  {
    value: "notice_only",
    title: "Tell you first",
    body: "The customer must tell you before going. No extra deposit."
  },
  {
    value: "not_permitted",
    title: "Not allowed",
    body: "The vehicle stays in your home area."
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--primary)]">Where you are based</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Home area</span>
            <input className={inputClass} defaultValue={settings.home_territory} name="homeTerritory" placeholder="Koh Samui" required />
            <span className="mt-1 block text-xs text-[var(--muted)]">Named in your agreements as where the vehicle is normally used.</span>
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
            { value: "island", label: "Island", helper: "Your agreements include the rule below about taking the vehicle off the island." },
            { value: "mainland", label: "Mainland", helper: "Vehicles travel freely on the mainland. Taking one to an island follows the rule below." }
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
              <span className="font-semibold text-[var(--foreground)]">{option.label}</span>
              <span className="mt-1 block text-xs text-[var(--muted)]">{option.helper}</span>
            </label>
          ))}
        </div>

        <label className="mt-3 block">
          <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Whose law applies</span>
          <input className={inputClass} name="jurisdiction" onChange={(event) => setJurisdiction(event.target.value)} required value={jurisdiction} />
          <span className="mt-1 block text-xs text-[var(--muted)]">Used word for word in your agreements.</span>
        </label>
      </section>

      <section className="form-section bg-[var(--primary-blue-light)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--primary)]">Taking the vehicle to another island</p>
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
              <span className="font-semibold text-[var(--foreground)]">{option.title}</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{option.body}</span>
            </label>
          ))}
        </div>
        {travelPolicy === "deposit_required" ? (
          <label className="mt-3 block max-w-sm">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Extra deposit amount (THB)</span>
            <input className={inputClass} defaultValue={settings.secondary_deposit_amount} min="0" name="secondaryDepositAmount" step="0.01" type="number" />
          </label>
        ) : (
          <input name="secondaryDepositAmount" type="hidden" value={settings.secondary_deposit_amount} />
        )}
        <label className="checkbox-label sub-surface mt-4 p-3">
          <input className="flex-shrink-0" defaultChecked={settings.geofence_monitoring_enabled} name="geofenceMonitoringEnabled" type="checkbox" />
          <span>
            <span className="block font-semibold text-[var(--foreground)]">Vehicles are tracked by GPS</span>
            <span className="mt-1 block text-xs text-[var(--muted)]">Adds a line to agreements telling the customer.</span>
          </span>
        </label>
      </section>

      <details className="form-section bg-[var(--warning-light)]" open>
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--primary)]">Fees and limits</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField defaultValue={settings.mileage_limit} label="Distance allowed per month (km)" name="mileageLimit" />
          <NumberField defaultValue={settings.fuel_charge_per_increment} label="Fuel charge per 1/8 tank missing (THB)" name="fuelChargePerIncrement" step="0.01" />
          <NumberField defaultValue={settings.late_fee_percentage} label="Late return fee (% per day)" name="lateFeePercentage" step="0.01" />
          <NumberField defaultValue={settings.cleaning_fee_minimum} label="Cleaning fee, from (THB)" name="cleaningFeeMinimum" step="0.01" />
          <NumberField defaultValue={settings.smoking_fee_maximum} label="Smoking fee, up to (THB)" name="smokingFeeMaximum" step="0.01" />
          <NumberField defaultValue={settings.emergency_repair_limit} label="Emergency repairs the customer may approve, up to (THB)" name="emergencyRepairLimit" step="0.01" />
          <NumberField defaultValue={settings.deposit_return_days} label="Deposit returned within (working days)" name="depositReturnDays" />
        </div>
      </details>

      <div className="flex flex-col gap-3 sm:flex-row">
        <PendingButton className="primary-action flex-1" pendingLabel="Saving..." savedLabel="Saved" type="submit">
          Save
        </PendingButton>
        <Link className="secondary-action pressable flex-1 text-[var(--primary)]" href="/settings/contracts">
          See the agreement wording
        </Link>
      </div>
    </form>
  );
}

function NumberField({ defaultValue, label, name, step = "1" }: { defaultValue: number; label: string; name: string; step?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">{label}</span>
      <input className={inputClass} defaultValue={defaultValue} min="0" name={name} step={step} type="number" />
    </label>
  );
}
