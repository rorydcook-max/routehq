"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { updateTravelPolicySettings } from "@/app/actions/settings";
import { PendingButton } from "@/components/pending-button";
import { ActionForm } from "@/components/action-form";
import { feeOn, lawOptionsFor, type FeeKey, type LocationTravelRules, type PlaceRule, type TravelPolicySettings } from "@/lib/travel-policy";
import { islandsOf, placeKind, placeName, placesFor } from "@/lib/travel-places";
import { SwitchField } from "@/components/switch-field";
import { InfoTip } from "@/components/info-tip";
import { MoneyInput } from "@/components/money-input";
import { displayNamesLocale } from "@/lib/i18n/dates";
import { distanceKey } from "@/lib/business-units";

type Say = (key: string, values?: Record<string, string | number>) => string;
const labelClass = "font-semibold text-[var(--foreground-secondary)]";
const headingClass = "text-[16px] font-bold text-[var(--foreground)]";

export type TravelFormLocation = {
  id: string;
  name: string;
  regionTexts: string[];
  rules: LocationTravelRules;
  own: boolean;
};

const OTHER_LAW = "__other__";

/**
 * Travel area and limits (Rory, 7 Nov 2026). Rules belong to each location: how far the vehicle may go, then one
 * Yes/No question per nearby country or island (lib/travel-places.ts), each Yes with an optional extra deposit and/or
 * notice, then whose law applies. With several locations a picker at the top switches between them; every location's
 * answers travel together in one hidden field, so switching never loses what was typed. Fees and GPS are for the
 * whole business. The country is the business's own (Settings › Country and units): there is no country box here.
 */
export function TravelPolicyForm({
  organizationId,
  settings,
  currency = "฿",
  currencyCode = "THB",
  unit = "km",
  country,
  locations
}: {
  organizationId: string;
  settings: TravelPolicySettings;
  currency?: string;
  currencyCode?: string;
  unit?: "km" | "mi";
  country: string;
  locations: TravelFormLocation[];
}) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const locale = useLocale();
  const [activeId, setActiveId] = useState(locations[0]?.id || "");
  const [rulesById, setRulesById] = useState<Record<string, LocationTravelRules>>(() => Object.fromEntries(locations.map((location) => [location.id, location.rules])));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [otherLaw, setOtherLaw] = useState<Record<string, boolean>>({});
  const active = locations.find((location) => location.id === activeId) || locations[0];
  const rules = active ? rulesById[active.id] : null;
  const islands = useMemo(() => islandsOf(country), [country]);

  // The main location is always saved (it is every other location's default); the others once they have rules of their own.
  const submitted = Object.fromEntries(
    locations.filter((location, index) => index === 0 || location.own || touched[location.id]).map((location) => [location.id, rulesById[location.id]])
  );

  function change(update: Partial<LocationTravelRules>) {
    if (!active) return;
    setRulesById((current) => ({ ...current, [active.id]: { ...current[active.id], ...update } }));
    setTouched((current) => ({ ...current, [active.id]: true }));
  }

  function changePlace(id: string, update: Partial<PlaceRule>) {
    if (!active) return;
    setRulesById((current) => {
      const now = current[active.id];
      const before = now.places[id] || { allowed: false, deposit: 0, notice: false };
      return { ...current, [active.id]: { ...now, places: { ...now.places, [id]: { ...before, ...update } } } };
    });
    setTouched((current) => ({ ...current, [active.id]: true }));
  }

  // Countries in the reader's language; islands and mainlands as written (English).
  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([displayNamesLocale(locale)], { type: "region" });
    } catch {
      return null;
    }
  }, [locale]);
  const shownName = (id: string) => {
    const english = placeName(id);
    if (placeKind(id) !== "country" || locale.startsWith("en")) return english;
    return regionNames?.of(id.split(":")[1]) || english;
  };

  const places = rules && active ? placesFor(country, rules.area, active.regionTexts) : [];
  const laws = lawOptionsFor(country)
    .slice()
    .sort((a, b) => a.replace(/^the /i, "").localeCompare(b.replace(/^the /i, ""), "en"));
  const lawChoice = rules && laws.includes(rules.law) ? rules.law : OTHER_LAW;
  const showOtherLaw = active ? Boolean(otherLaw[active.id]) || lawChoice === OTHER_LAW : false;

  const choiceClass = (selected: boolean) => `block cursor-pointer rounded-xl p-3 ${selected ? "bg-[var(--primary-light)] ring-2 ring-[var(--primary)]" : "bg-[var(--panel-secondary)]"}`;
  const pillClass = (selected: boolean) =>
    `pressable min-h-[40px] max-w-full truncate rounded-full px-3.5 font-semibold ${selected ? "bg-[var(--primary)] text-white" : "bg-[var(--panel-secondary)] text-[var(--foreground)]"}`;

  return (
    <ActionForm action={updateTravelPolicySettings} className="mt-3 space-y-5">
      <input name="organizationId" type="hidden" value={organizationId} />
      <input name="travelRules" type="hidden" value={JSON.stringify(submitted)} />

      {locations.length > 1 ? (
        <div>
          <p className={labelClass}>
            {say("tr_location")} <InfoTip label={say("tr_location")} text={say("tr_locationsHelp")} />
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2" role="tablist">
            {locations.map((location) => (
              <button aria-selected={location.id === active?.id} className={pillClass(location.id === active?.id)} key={location.id} onClick={() => setActiveId(location.id)} role="tab" type="button">
                {location.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {rules && active ? (
        <>
          <section>
            <p className={headingClass}>{say("tr_where")}</p>
            {islands.length ? (
              <label className="mt-2.5 block max-w-sm">
                <span className={labelClass}>{say("tr_island")}</span>
                <select className="mt-1 w-full" onChange={(event) => change({ area: event.target.value })} value={rules.area}>
                  <option value="">{say("tr_islandNo")}</option>
                  {islands.map((island) => (
                    <option key={island.id} value={island.id}>
                      {island.name.replace(/^the /, "The ")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <label className={choiceClass(rules.limit === "none")}>
                <input checked={rules.limit === "none"} className="sr-only" name={`limit_${active.id}`} onChange={() => change({ limit: "none" })} type="radio" />
                <span className="block font-bold text-[var(--foreground)]">{say("tr_noLimit")}</span>
                <span className="mt-0.5 block font-medium text-[var(--foreground-secondary)]">{say("tr_noLimitBody")}</span>
              </label>
              <label className={choiceClass(rules.limit === "radius")}>
                <input checked={rules.limit === "radius"} className="sr-only" name={`limit_${active.id}`} onChange={() => change({ limit: "radius", radius: rules.radius || 50 })} type="radio" />
                <span className="block font-bold text-[var(--foreground)]">{say("tr_radius")}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2 font-medium text-[var(--foreground-secondary)]">
                  <input
                    aria-label={say("tr_radius")}
                    className="w-24 text-end"
                    inputMode="numeric"
                    min="1"
                    onChange={(event) => change({ limit: "radius", radius: Math.max(0, Math.round(Number(event.target.value) || 0)) })}
                    onFocus={() => {
                      if (rules.limit !== "radius") change({ limit: "radius", radius: rules.radius || 50 });
                    }}
                    step="1"
                    type="number"
                    value={rules.radius || ""}
                  />
                  <span className="min-w-0">{say(unit === "mi" ? "tr_radiusMi" : "tr_radiusKm", { place: rules.anchor || active.name })}</span>
                </span>
              </label>
            </div>
          </section>

          <section>
            <p className={headingClass}>
              {say("tr_places")} <InfoTip label={say("tr_places")} text={say("tr_placesTip")} />
            </p>
            {places.length ? (
              <div className="mt-2.5 grid gap-2">
                {places.map((id) => {
                  const rule = rules.places[id] || { allowed: false, deposit: 0, notice: false };
                  const question = say("tr_ask", { place: shownName(id) });
                  return (
                    <div className="rounded-xl bg-[var(--panel-secondary)] px-3.5 py-2.5" key={`${active.id}-${id}`}>
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <span className="min-w-0 flex-1 basis-48 font-semibold leading-6 text-[var(--foreground)]">{question}</span>
                        <span aria-label={question} className="inline-flex shrink-0 rounded-full bg-[var(--panel)] p-1" role="radiogroup">
                          {[true, false].map((value) => (
                            <button
                              aria-checked={rule.allowed === value}
                              className={`min-h-[36px] min-w-[56px] rounded-full px-3 font-semibold ${
                                rule.allowed === value ? (value ? "bg-[var(--primary)] text-white" : "bg-[var(--foreground)] text-[var(--background)]") : "text-[var(--foreground-secondary)]"
                              }`}
                              key={String(value)}
                              onClick={() => changePlace(id, { allowed: value })}
                              role="radio"
                              type="button"
                            >
                              {say(value ? "tr_yes" : "tr_no")}
                            </button>
                          ))}
                        </span>
                      </div>
                      {rule.allowed ? (
                        <div className="mt-2.5 grid gap-2.5 border-t border-[var(--border)] pt-2.5 sm:grid-cols-2 sm:items-end">
                          <label className="block">
                            <span className={labelClass}>{say("tr_deposit")}</span>
                            <MoneyInput
                              currency={currencyCode}
                              defaultValue={rule.deposit || ""}
                              key={`${active.id}-${id}-deposit`}
                              name={`travelDeposit_${id}`}
                              onValueChange={(value) => changePlace(id, { deposit: Number(value) || 0 })}
                            />
                          </label>
                          <label className="flex min-h-[48px] cursor-pointer items-center gap-3">
                            <input checked={rule.notice} className="switch" onChange={(event) => changePlace(id, { notice: event.target.checked })} role="switch" type="checkbox" />
                            <span className="font-semibold text-[var(--foreground)]">{say("tr_notice")}</span>
                          </label>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1 font-medium text-[var(--muted)]">{say("tr_noPlaces")}</p>
            )}
          </section>

          <section>
            <label className="block max-w-sm">
              <span className={labelClass}>
                {say("tp_law")} <InfoTip label={say("tp_law")} text={say("tp_lawHelp")} />
              </span>
              <select
                className="mt-1 w-full"
                onChange={(event) => {
                  const value = event.target.value;
                  setOtherLaw((current) => ({ ...current, [active.id]: value === OTHER_LAW }));
                  if (value !== OTHER_LAW) change({ law: value });
                  else if (laws.includes(rules.law)) change({ law: "" });
                }}
                value={showOtherLaw ? OTHER_LAW : lawChoice}
              >
                {laws.map((law) => (
                  <option key={law} value={law}>
                    {law.replace(/^the /, "The ")}
                  </option>
                ))}
                <option value={OTHER_LAW}>{say("tr_lawOther")}</option>
              </select>
            </label>
            {showOtherLaw ? (
              <label className="mt-2.5 block max-w-sm">
                <span className={labelClass}>{say("tr_lawType")}</span>
                <input className="mt-1 w-full" maxLength={160} onChange={(event) => change({ law: event.target.value })} required value={rules.law} />
              </label>
            ) : null}
          </section>
        </>
      ) : null}

      <section>
        {locations.length > 1 ? <p className="mb-2 font-medium text-[var(--muted)]">{say("tr_allLocations")}</p> : null}
        <SwitchField
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
              currencyCode={fee.money ? currencyCode : undefined}
              label={say(fee.label === "tp_km" ? distanceKey("tp_km") : fee.label, { currency })}
              name={fee.name}
              offText={say(`tp_off_${fee.key}`)}
              on={feeOn(settings, fee.key)}
              onName={`feeOn_${fee.key}`}
              step={fee.step}
            />
          ))}
          {/* Empty: a late return is priced from the vehicle's day rate, else its monthly rate x 12 / 365 (lib/late-return.ts). */}
          <div className="flex min-h-[60px] items-center justify-between gap-3 rounded-xl bg-[var(--panel-secondary)] px-3.5 py-2.5">
            <span className="min-w-0 font-semibold leading-6 text-[var(--foreground)]">{say("tp_lateReturnPerDay")}</span>
            <MoneyInput className="w-32 shrink-0" currency={currencyCode} defaultValue={settings.late_return_fee_per_day ?? ""} label={say("tp_lateReturnPerDay")} name="lateReturnFeePerDay" />
          </div>
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
    </ActionForm>
  );
}

// `money`: an amount in the business's currency, typed in a box with its symbol inside (not in the label).
const FEES: Array<{ key: FeeKey; name: string; label: string; step: string; money?: boolean }> = [
  { key: "mileage_limit", name: "mileageLimit", label: "tp_km", step: "1" },
  { key: "fuel_charge_per_increment", name: "fuelChargePerIncrement", label: "tp_fuel", step: "0.01", money: true },
  { key: "late_fee_percentage", name: "lateFeePercentage", label: "tp_late", step: "0.01" },
  { key: "cleaning_fee_minimum", name: "cleaningFeeMinimum", label: "tp_cleaning", step: "0.01", money: true },
  { key: "smoking_fee_maximum", name: "smokingFeeMaximum", label: "tp_smoking", step: "0.01", money: true },
  { key: "emergency_repair_limit", name: "emergencyRepairLimit", label: "tp_repairs", step: "0.01", money: true },
  { key: "deposit_return_days", name: "depositReturnDays", label: "tp_depositDays", step: "1" }
];

/** A fee or limit with its own switch. Switched off, the amount is kept (hidden) for when it comes back on. */
function FeeRow({ currencyCode, defaultValue, label, name, on: initialOn, onName, offText, step }: { currencyCode?: string; defaultValue: number; label: string; name: string; on: boolean; onName: string; offText: string; step: string }) {
  const [on, setOn] = useState(initialOn);
  const [value, setValue] = useState(String(defaultValue));
  return (
    <div className="flex min-h-[60px] items-center justify-between gap-3 rounded-xl bg-[var(--panel-secondary)] px-3.5 py-2.5">
      <label className="flex min-w-0 cursor-pointer items-start gap-3">
        <input checked={on} className="switch" name={onName} onChange={(event) => setOn(event.target.checked)} role="switch" type="checkbox" value="on" />
        <span className="min-w-0 font-semibold leading-6 text-[var(--foreground)]">{label}</span>
      </label>
      {on && currencyCode ? (
        <MoneyInput className="w-32 shrink-0" currency={currencyCode} defaultValue={value} label={label} name={name} onValueChange={setValue} required />
      ) : on ? (
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
