"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveRegionalSettings, type RegionalInput } from "@/app/actions/regional";
import { ALL_COUNTRY_CODES, allCurrencies, countryInfo, englishCountryName, zoneName, zoneOffset, zonesFor, type DistanceUnit } from "@/lib/regional";
import { displayNamesLocale } from "@/lib/i18n/dates";
import { InfoTip } from "@/components/info-tip";
import { SearchSelect } from "@/components/search-select";

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
  // Every country and every ISO currency (build-s, 8 Nov 2026), searchable and alphabetical in the reader's language.
  const names = useMemo(() => {
    let display: Intl.DisplayNames | null = null;
    try {
      display = new Intl.DisplayNames([displayNamesLocale(locale)], { type: "region" });
    } catch {
      display = null;
    }
    return ALL_COUNTRY_CODES.map((code) => ({ value: code, label: display?.of(code) || englishCountryName(code) })).sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [locale]);
  const currencies = useMemo(() => {
    let display: Intl.DisplayNames | null = null;
    try {
      display = new Intl.DisplayNames([displayNamesLocale(locale)], { type: "currency" });
    } catch {
      display = null;
    }
    return Array.from(new Set([...allCurrencies(), form.currency].filter(Boolean)))
      .sort()
      .map((code) => ({ value: code, label: code, hint: display?.of(code) && display.of(code) !== code ? display.of(code) : undefined }));
  }, [locale, form.currency]);
  const info = countryInfo(form.country);
  // Every IANA time zone in the country, alphabetical by place.
  const zones = Array.from(new Set([...zonesFor(form.country), form.timezone].filter(Boolean))).sort((a, b) => zoneName(a).localeCompare(zoneName(b), locale));
  const update = (patch: Partial<RegionalInput>) => {
    setNote(null);
    setForm((current) => ({ ...current, ...patch }));
  };
  // Changing the country or currency after setup asks first and says what changes (real-user test, 8 Nov 2026).
  const [confirm, setConfirm] = useState<{ patch: Partial<RegionalInput>; lines: string[] } | null>(null);
  const currencyLine = (to: string) => say("reg_confirmCurrency", { to, from: initial.currency || form.currency });
  const pickCountry = (code: string) => {
    const next = countryInfo(code);
    if (!next || code === form.country) return;
    // A new country brings its usual time zone, money, distance unit and VAT rate; each can still be changed.
    const patch = { country: code, timezone: next.zones[0], currency: next.currency, distanceUnit: next.unit, vat: { ...form.vat, rate: next.vat } };
    if (!initial.country) return update(patch);
    const lines = [
      say("reg_confirmCountry", {
        currency: next.currency,
        zone: `${zoneName(next.zones[0])} ${zoneOffset(next.zones[0])}`.trim(),
        unit: say(next.unit === "mi" ? "reg_mi" : "reg_km"),
        vat: next.vat
      })
    ];
    if (next.currency !== (initial.currency || form.currency)) lines.push(currencyLine(next.currency));
    setConfirm({ patch, lines });
  };
  const pickCurrency = (code: string) => {
    if (code === form.currency) return;
    if (!initial.currency || code === initial.currency) return update({ currency: code });
    setConfirm({ patch: { currency: code }, lines: [currencyLine(code)] });
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
        <div className="block">
          <span className={small}>{say("reg_country")}</span>
          <SearchSelect ariaLabel={say("reg_country")} onChange={pickCountry} options={names} value={form.country} />
        </div>
        <div className="block">
          <span className={small}>{say("reg_zone")}</span>
          {/* A country with one time zone (Thailand) shows it as a fact, not a dropdown with one choice. */}
          {zones.length < 2 ? (
            <span className="mt-1 flex min-h-10 w-full items-center rounded-[var(--radius-md,10px)] bg-[var(--surface-muted,#f3f6f6)] px-3 text-sm font-semibold">
              {zoneName(form.timezone)} {zoneOffset(form.timezone)}
            </span>
          ) : (
            <SearchSelect
              ariaLabel={say("reg_zone")}
              onChange={(zone) => update({ timezone: zone })}
              options={zones.map((zone) => ({ value: zone, label: zoneName(zone), hint: zoneOffset(zone) }))}
              value={form.timezone}
            />
          )}
        </div>
        <div className="block">
          <span className={small}>{say("reg_currency")}</span>
          <SearchSelect ariaLabel={say("reg_currency")} onChange={pickCurrency} options={currencies} value={form.currency} />
        </div>
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
      {confirm ? (
        <div className="rounded-xl border border-[var(--warning-line)] bg-[var(--warning-light)] p-3" role="alertdialog" aria-label={say("reg_confirmChange")}>
          {confirm.lines.map((line) => (
            <p className="text-sm font-semibold text-[var(--foreground)]" key={line}>
              {line}
            </p>
          ))}
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="secondary-action pressable" onClick={() => setConfirm(null)} type="button">
              {say("reg_confirmCancel")}
            </button>
            <button
              className="primary-action pressable"
              onClick={() => {
                update(confirm.patch);
                setConfirm(null);
              }}
              type="button"
            >
              {say("reg_confirmChange")}
            </button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button className="primary-action pressable" disabled={pending || Boolean(confirm)} onClick={save} type="button">
          {pending ? say("saving") : say("save")}
        </button>
        {note ? <span className={`text-sm font-semibold ${note === "saved" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{note === "saved" ? say("saved") : note}</span> : null}
      </div>
    </div>
  );
}
