"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveRegionalSettings, type RegionalInput } from "@/app/actions/regional";
import { COUNTRIES, countryInfo, zoneName, zoneOffset, type DistanceUnit } from "@/lib/regional";
import { displayNamesLocale } from "@/lib/i18n/dates";
import { InfoTip } from "@/components/info-tip";

type Say = (key: string, values?: Record<string, string | number>) => string;
const small = "text-[13px] font-semibold text-[var(--foreground-secondary)]";

/**
 * Country and units (Settings › Rentals): the country sets sensible defaults for time zone, currency, miles or km and the
 * VAT rate; each can then be changed. Few fields, one save.
 */
export function RegionalPanel({ initial }: { initial: RegionalInput }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const locale = useLocale();
  const [form, setForm] = useState<RegionalInput>(initial);
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const names = useMemo(() => {
    let display: Intl.DisplayNames | null = null;
    try {
      display = new Intl.DisplayNames([displayNamesLocale(locale)], { type: "region" });
    } catch {
      display = null;
    }
    return COUNTRIES.map((country) => ({ code: country.code, name: display?.of(country.code) || country.name })).sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [locale]);
  const info = countryInfo(form.country);
  const zones = Array.from(new Set([...(info?.zones || []), form.timezone].filter(Boolean)));
  const currencies = Array.from(new Set([info?.currency || "", form.currency, "EUR", "USD"].filter(Boolean))).sort();
  const update = (patch: Partial<RegionalInput>) => {
    setNote(null);
    setForm((current) => ({ ...current, ...patch }));
  };
  const pickCountry = (code: string) => {
    const next = countryInfo(code);
    if (!next) return;
    // A new country brings its usual time zone, money, distance unit and VAT rate; each can still be changed.
    update({ country: code, timezone: next.zones[0], currency: next.currency, distanceUnit: next.unit, vat: { ...form.vat, rate: next.vat } });
  };
  const save = () =>
    start(async () => {
      const result = await saveRegionalSettings(form);
      setNote(result.ok ? "saved" : result.error);
    });
  const vatNote = info?.vatNote ? say(`vat_note_${info.vatNote}`) : null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={small}>{say("reg_country")}</span>
          <select className="mt-1 w-full" onChange={(event) => pickCountry(event.target.value)} value={form.country}>
            {names.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={small}>{say("reg_zone")}</span>
          {/* A country with one time zone (Thailand) shows it as a fact, not a dropdown with one choice. */}
          {zones.length < 2 ? (
            <span className="mt-1 flex min-h-10 w-full items-center rounded-[var(--radius-md,10px)] bg-[var(--surface-muted,#f3f6f6)] px-3 text-sm font-semibold">
              {zoneName(form.timezone)} {zoneOffset(form.timezone)}
            </span>
          ) : (
            <select className="mt-1 w-full" onChange={(event) => update({ timezone: event.target.value })} value={form.timezone}>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zoneName(zone)} {zoneOffset(zone)}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="block">
          <span className={small}>{say("reg_currency")}</span>
          <select className="mt-1 w-full" onChange={(event) => update({ currency: event.target.value })} value={form.currency}>
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={small}>
            {say("reg_distance")} <InfoTip label={say("reg_distance")} text={say("reg_distanceTip")} />
          </span>
          <select className="mt-1 w-full" onChange={(event) => update({ distanceUnit: event.target.value as DistanceUnit })} value={form.distanceUnit}>
            <option value="km">{say("reg_km")}</option>
            <option value="mi">{say("reg_mi")}</option>
          </select>
        </label>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
        <label className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
          <input checked={form.vat.registered} onChange={(event) => update({ vat: { ...form.vat, registered: event.target.checked } })} type="checkbox" />
          {say("vat_on")} <InfoTip label={say("vat_on")} text={say("vat_onTip")} />
        </label>
        {form.vat.registered ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={small}>{say("vat_number")}</span>
              <input className="mt-1 w-full" maxLength={40} onChange={(event) => update({ vat: { ...form.vat, number: event.target.value } })} value={form.vat.number} />
            </label>
            <label className="block">
              <span className={small}>{say("vat_rate")}</span>
              <input
                className="mt-1 w-full"
                inputMode="decimal"
                onChange={(event) => update({ vat: { ...form.vat, rate: Number(event.target.value.replace(",", ".").replace(/[^\d.]/g, "")) || 0 } })}
                value={form.vat.rate ? String(form.vat.rate) : ""}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground-secondary)] sm:col-span-2">
              <input checked={form.vat.included} onChange={(event) => update({ vat: { ...form.vat, included: event.target.checked } })} type="checkbox" />
              {say("vat_included")} <InfoTip label={say("vat_included")} text={say("vat_includedTip")} />
            </label>
            {vatNote ? <p className="text-[13px] text-[var(--muted)] sm:col-span-2">{vatNote}</p> : null}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="primary-action pressable" disabled={pending} onClick={save} type="button">
          {pending ? say("saving") : say("save")}
        </button>
        {note ? <span className={`text-sm font-semibold ${note === "saved" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{note === "saved" ? say("saved") : note}</span> : null}
      </div>
    </div>
  );
}
