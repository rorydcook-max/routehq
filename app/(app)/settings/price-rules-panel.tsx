"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { saveExtras, saveSeasons } from "@/app/actions/price-rules";
import { EXTRA_PRESETS, type Extra, type ExtraPreset, type Season } from "@/lib/price-rules";
import { dateFormat } from "@/lib/i18n/dates";
import { InfoTip } from "@/components/info-tip";

type Say = (key: string, values?: Record<string, string | number>) => string;
const field = "mt-1 w-full";
const small = "text-[12px] font-semibold text-[var(--foreground-secondary)]";
const newId = () => Math.random().toString(36).slice(2, 10);

/** A ready-made extra as first added: per day or once, for cars or all; the owner fills the price. */
function readyMade(preset: ExtraPreset, name: string): Extra {
  const perRental = preset === "cross_border" || preset === "out_of_hours" || preset === "one_way";
  return {
    id: newId(),
    name,
    price: 0,
    per: perRental ? "rental" : "day",
    kind: "all",
    preset,
    ...(preset === "damage_waiver" ? { excess: 0 } : {}),
    ...(preset === "young_driver" ? { minAge: 25 } : {}),
    ...(preset === "cross_border" ? { countries: "" } : {})
  };
}

function useSave(save: () => Promise<{ ok: boolean; error?: string }>) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const run = () =>
    start(async () => {
      const result = await save();
      setNote(result.ok ? "saved" : result.error || "error");
    });
  return { pending, note, run, clear: () => setNote(null) };
}

/** A day and month, the same every year. */
function DayMonth({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const locale = useLocale();
  const [month, day] = value ? value.split("-") : ["01", "01"];
  const months = Array.from({ length: 12 }, (_, index) => dateFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, index, 1))));
  return (
    <label className="block">
      <span className={small}>{label}</span>
      <span className="mt-1 flex gap-1.5">
        <select aria-label={label} className="w-20" onChange={(event) => onChange(`${month}-${event.target.value}`)} value={day}>
          {Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0")).map((value) => (
            <option key={value} value={value}>
              {Number(value)}
            </option>
          ))}
        </select>
        <select aria-label={label} className="min-w-0 flex-1" onChange={(event) => onChange(`${event.target.value}-${day}`)} value={month}>
          {months.map((name, index) => (
            <option key={name} value={String(index + 1).padStart(2, "0")}>
              {name}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

export function SeasonsPanel({ initial }: { initial: Season[] }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [rows, setRows] = useState<Season[]>(initial);
  const save = useSave(() => saveSeasons(rows));
  const change = (id: string, patch: Partial<Season>) => {
    save.clear();
    setRows((list) => list.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };
  return (
    <div className="space-y-3">
      <p className="font-medium text-[var(--foreground-secondary)]">{say("season_body")}</p>
      {rows.map((row) => (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-3" key={row.id}>
          <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr_0.6fr_auto] sm:items-end">
            <label className="block">
              <span className={small}>{say("season_name")}</span>
              <input className={field} maxLength={60} onChange={(event) => change(row.id, { name: event.target.value })} placeholder={say("season_namePh")} value={row.name} />
            </label>
            <DayMonth label={say("season_from")} onChange={(value) => change(row.id, { from: value })} value={row.from} />
            <DayMonth label={say("season_to")} onChange={(value) => change(row.id, { to: value })} value={row.to} />
            <label className="block">
              <span className={small}>
                {say("season_pct")} <InfoTip label={say("season_pct")} text={say("season_pctTip")} />
              </span>
              <input className={field} inputMode="numeric" onChange={(event) => change(row.id, { pct: Number(event.target.value.replace(/[^\d-]/g, "")) || 0 })} value={row.pct ? String(row.pct) : ""} />
            </label>
            <button aria-label={say("remove")} className="flex min-h-10 items-center justify-center text-[var(--muted)] hover:text-[var(--danger)]" onClick={() => { save.clear(); setRows((list) => list.filter((item) => item.id !== row.id)); }} type="button">
              <Trash2 size={18} />
            </button>
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm font-medium text-[var(--foreground-secondary)]">
            <input checked={row.monthly} onChange={(event) => change(row.id, { monthly: event.target.checked })} type="checkbox" />
            {say("season_monthly")} <InfoTip label={say("season_monthly")} text={say("season_monthlyTip")} />
          </label>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button className="secondary-action pressable" onClick={() => { save.clear(); setRows((list) => [...list, { id: newId(), name: "", from: "12-15", to: "01-15", pct: 20, monthly: false }]); }} type="button">
          <Plus size={16} />
          {say("season_add")}
        </button>
        <button className="primary-action pressable" disabled={save.pending} onClick={save.run} type="button">
          {save.pending ? say("saving") : say("save")}
        </button>
        {save.note ? <span className={`text-sm font-semibold ${save.note === "saved" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{save.note === "saved" ? say("saved") : save.note}</span> : null}
      </div>
    </div>
  );
}

export function ExtrasPanel({ initial, currencySymbol }: { initial: Extra[]; currencySymbol: string }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [rows, setRows] = useState<Extra[]>(initial);
  const save = useSave(() => saveExtras(rows));
  const change = (id: string, patch: Partial<Extra>) => {
    save.clear();
    setRows((list) => list.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };
  return (
    <div className="space-y-3">
      <p className="font-medium text-[var(--foreground-secondary)]">
        {say("extra_body")} <InfoTip label={say("extra_title")} text={say("extra_bodyTip")} />
      </p>
      {rows.map((row) => (
        <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-3 sm:grid-cols-[1.4fr_0.8fr_1fr_1fr_auto] sm:items-end" key={row.id}>
          <label className="block">
            <span className={small}>{say("extra_name")}</span>
            <input className={field} maxLength={60} onChange={(event) => change(row.id, { name: event.target.value })} placeholder={say("extra_namePh")} value={row.name} />
          </label>
          <label className="block">
            <span className={small}>{say("extra_price", { symbol: currencySymbol })}</span>
            <input className={field} inputMode="numeric" onChange={(event) => change(row.id, { price: Number(event.target.value.replace(/[^\d]/g, "")) || 0 })} value={row.price ? String(row.price) : ""} />
          </label>
          <label className="block">
            <span className={small}>{say("extra_per")}</span>
            <select className={field} onChange={(event) => change(row.id, { per: event.target.value as Extra["per"] })} value={row.per}>
              <option value="day">{say("extra_perDay")}</option>
              <option value="rental">{say("extra_perRental")}</option>
            </select>
          </label>
          <label className="block">
            <span className={small}>{say("extra_for")}</span>
            <select className={field} onChange={(event) => change(row.id, { kind: event.target.value as Extra["kind"] })} value={row.kind}>
              <option value="all">{say("extra_forAll")}</option>
              <option value="car">{say("extra_forCars")}</option>
              <option value="bike">{say("extra_forBikes")}</option>
            </select>
          </label>
          <button aria-label={say("remove")} className="flex min-h-10 items-center justify-center text-[var(--muted)] hover:text-[var(--danger)]" onClick={() => { save.clear(); setRows((list) => list.filter((item) => item.id !== row.id)); }} type="button">
            <Trash2 size={18} />
          </button>
          {/* A ready-made extra's own detail: the lower excess, the age, the countries allowed. */}
          {row.preset === "damage_waiver" ? (
            <label className="block sm:col-span-2">
              <span className={small}>
                {say("xp_excess", { symbol: currencySymbol })} <InfoTip label={say("xp_excess", { symbol: currencySymbol })} text={say("xp_excessTip")} />
              </span>
              <input className={field} inputMode="numeric" onChange={(event) => change(row.id, { excess: Number(event.target.value.replace(/[^\d]/g, "")) || 0 })} value={row.excess ? String(row.excess) : ""} />
            </label>
          ) : null}
          {row.preset === "young_driver" ? (
            <label className="block sm:col-span-2">
              <span className={small}>{say("xp_minAge")}</span>
              <input className={field} inputMode="numeric" onChange={(event) => change(row.id, { minAge: Number(event.target.value.replace(/[^\d]/g, "")) || 0 })} value={row.minAge ? String(row.minAge) : ""} />
            </label>
          ) : null}
          {row.preset === "cross_border" ? (
            <label className="block sm:col-span-3">
              <span className={small}>{say("xp_countries")}</span>
              <input className={field} maxLength={200} onChange={(event) => change(row.id, { countries: event.target.value })} placeholder={say("xp_countriesPh")} value={row.countries || ""} />
            </label>
          ) : null}
        </div>
      ))}
      {/* Ready-made extras common in Europe: one tap adds it with a sensible start; the owner sets the price. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={small}>{say("xp_ready")}</span>
        {EXTRA_PRESETS.filter((preset) => !rows.some((row) => row.preset === preset))
          .map((preset) => ({ preset, label: say(`xp_${preset}`) }))
          .sort((a, b) => a.label.localeCompare(b.label))
          .map(({ preset, label }) => (
            <button
              className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[14px] font-semibold text-[var(--foreground)] hover:border-[var(--primary)]"
              key={preset}
              onClick={() => { save.clear(); setRows((list) => [...list, readyMade(preset, label)]); }}
              type="button"
            >
              + {label}
            </button>
          ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="secondary-action pressable" onClick={() => { save.clear(); setRows((list) => [...list, { id: newId(), name: "", price: 0, per: "day", kind: "all" }]); }} type="button">
          <Plus size={16} />
          {say("extra_add")}
        </button>
        <button className="primary-action pressable" disabled={save.pending} onClick={save.run} type="button">
          {save.pending ? say("saving") : say("save")}
        </button>
        {save.note ? <span className={`text-sm font-semibold ${save.note === "saved" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{save.note === "saved" ? say("saved") : save.note}</span> : null}
      </div>
    </div>
  );
}
