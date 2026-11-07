"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Trash2, X } from "lucide-react";
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

/** A vehicle an extra can be limited to: its name as the fleet shows it, and its plate. */
export type ExtraVehicle = { id: string; name: string; plate: string | null };

/** The price as shown on a pill and in the sheet: the business's own currency, no decimals when there are none. */
function priceText(symbol: string, price: number) {
  return `${symbol}${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/**
 * Paid extras (Rory, 7 Nov 2026): the saved ones are pills, like the ready-made options. Tapping a pill opens a small
 * sheet to change it (name, price with the business's currency in the field, per day or per booking, which vehicles,
 * delete); "Add an extra" and the ready-made pills open the same sheet. Saving stores the list at once, closes the
 * sheet and shows the pill. A price of 0 is a free extra. Before, a new extra with no price was dropped on save
 * without a word, so adding one seemed to do nothing.
 */
export function ExtrasPanel({ initial, currencySymbol, vehicles = [] }: { initial: Extra[]; currencySymbol: string; vehicles?: ExtraVehicle[] }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const router = useRouter();
  const [rows, setRows] = useState<Extra[]>(initial);
  const [editing, setEditing] = useState<{ extra: Extra; isNew: boolean } | null>(null);

  const pillPrice = (extra: Extra) =>
    extra.price > 0 ? say(extra.per === "day" ? "extra_pillDay" : "extra_pillRental", { price: priceText(currencySymbol, extra.price) }) : say("extra_free");

  async function store(next: Extra[]): Promise<string | null> {
    const result = await saveExtras(next);
    if (!result.ok) return result.error || say("extra_saveFailed");
    setRows(next);
    router.refresh();
    return null;
  }

  const presetsLeft = EXTRA_PRESETS.filter((preset) => !rows.some((row) => row.preset === preset))
    .map((preset) => ({ preset, label: say(`xp_${preset}`) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="space-y-4">
      <p className="font-medium text-[var(--foreground-secondary)]">
        {say("extra_body")} <InfoTip label={say("extra_title")} text={say("extra_bodyTip")} />
      </p>
      {rows.length ? (
        <ul className="flex flex-wrap gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                className="pressable inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border border-[var(--primary)] bg-[var(--primary-light)] px-3.5 py-1.5 text-start text-[14px] font-semibold text-[var(--foreground)]"
                onClick={() => setEditing({ extra: row, isNew: false })}
                type="button"
              >
                <span className="min-w-0 truncate">{row.name}</span>
                <span className="shrink-0 font-medium text-[var(--foreground-secondary)]">· {pillPrice(row)}</span>
                <Pencil aria-hidden="true" className="shrink-0 text-[var(--primary)]" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {/* Ready-made extras common in Europe: one tap opens the sheet with a sensible start; the owner sets the price. */}
      {presetsLeft.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className={small}>{say("xp_ready")}</span>
          {presetsLeft.map(({ preset, label }) => (
            <button
              className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[14px] font-semibold text-[var(--foreground)] hover:border-[var(--primary)]"
              key={preset}
              onClick={() => setEditing({ extra: readyMade(preset, label), isNew: true })}
              type="button"
            >
              + {label}
            </button>
          ))}
        </div>
      ) : null}
      <button className="secondary-action pressable" onClick={() => setEditing({ extra: { id: newId(), name: "", price: 0, per: "day", kind: "all" }, isNew: true })} type="button">
        <Plus size={16} />
        {say("extra_add")}
      </button>
      {editing ? (
        <ExtraSheet
          currencySymbol={currencySymbol}
          extra={editing.extra}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onDelete={async () => {
            const error = await store(rows.filter((row) => row.id !== editing.extra.id));
            if (!error) setEditing(null);
            return error;
          }}
          onSave={async (extra) => {
            const next = editing.isNew ? [...rows, extra] : rows.map((row) => (row.id === extra.id ? extra : row));
            const error = await store(next);
            if (!error) setEditing(null);
            return error;
          }}
          vehicles={vehicles}
        />
      ) : null}
    </div>
  );
}

/** The sheet for one extra: a bottom sheet on a phone, a box in the middle on a computer. */
function ExtraSheet({
  extra,
  isNew,
  currencySymbol,
  vehicles,
  onClose,
  onSave,
  onDelete
}: {
  extra: Extra;
  isNew: boolean;
  currencySymbol: string;
  vehicles: ExtraVehicle[];
  onClose: () => void;
  onSave: (extra: Extra) => Promise<string | null>;
  onDelete: () => Promise<string | null>;
}) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [draft, setDraft] = useState<Extra>(extra);
  const [priceTyped, setPriceTyped] = useState(extra.price ? String(extra.price) : "");
  // "Chosen vehicles" when the extra names some; the older cars-only or motorbikes-only choice stays as it was.
  const [scope, setScope] = useState<"all" | "chosen" | "kind">(extra.vehicleIds?.length ? "chosen" : extra.kind === "all" ? "all" : "kind");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const change = (patch: Partial<Extra>) => {
    setError(null);
    setDraft((current) => ({ ...current, ...patch }));
  };
  const chosen = new Set(draft.vehicleIds || []);
  const sortedVehicles = [...vehicles].sort((a, b) => a.name.localeCompare(b.name) || String(a.plate || "").localeCompare(String(b.plate || "")));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save() {
    const name = draft.name.trim();
    if (!name) return setError(say("extra_nameNeeded"));
    if (scope === "chosen" && !chosen.size) return setError(say("extra_pickVehicle"));
    const price = Math.max(0, Math.round((Number(priceTyped.replace(/,/g, "")) || 0) * 100) / 100);
    const clean: Extra = { ...draft, name, price, kind: scope === "kind" ? draft.kind : "all" };
    if (scope === "chosen") clean.vehicleIds = [...chosen];
    else delete clean.vehicleIds;
    start(async () => {
      const failed = await onSave(clean);
      if (failed) setError(failed);
    });
  }

  const segment = (on: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-[15px] font-semibold transition ${on ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--foreground-secondary)]"}`;

  // On the page itself, not inside the folded card: a transformed parent would pin a fixed sheet to the card.
  return createPortal(
    <div className="sheet-scrim fixed inset-0 z-[60] flex items-end bg-[var(--foreground)]/40 lg:items-center lg:justify-center" onClick={onClose}>
      <div
        aria-label={isNew ? say("extra_sheetNew") : say("extra_sheetEdit")}
        aria-modal="true"
        className="surface-panel phone-sheet flex max-h-[90vh] w-full flex-col rounded-t-3xl shadow-xl lg:w-[480px] lg:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <span aria-hidden="true" className="lg:hidden">
          <span className="sheet-grabber" />
        </span>
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 className="sheet-title">{isNew ? say("extra_sheetNew") : say("extra_sheetEdit")}</h2>
          <button aria-label={say("cancel")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--panel-secondary)] text-[var(--foreground-secondary)]" onClick={onClose} type="button">
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
          <label className="block">
            <span className={small}>{say("extra_name")}</span>
            <input autoFocus={isNew && !draft.name} className={field} maxLength={60} onChange={(event) => change({ name: event.target.value })} placeholder={say("extra_namePh")} value={draft.name} />
          </label>
          <label className="block">
            <span className={small}>{say("extra_priceShort")}</span>
            {/* The business's own currency inside the field (never a fixed baht sign). */}
            <span className="relative mt-1 block">
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-3 flex items-center font-semibold text-[var(--foreground-secondary)]">
                {currencySymbol}
              </span>
              <input
                className="w-full"
                inputMode="decimal"
                onChange={(event) => {
                  setError(null);
                  setPriceTyped(event.target.value.replace(/[^\d.,]/g, ""));
                }}
                placeholder="0"
                style={{ paddingInlineStart: `calc(1.25rem + ${Math.max(1, currencySymbol.length)}ch)` }}
                value={priceTyped}
              />
            </span>
            <span className="mt-1 block text-[13px] font-medium text-[var(--muted)]">{say("extra_priceHint")}</span>
          </label>
          <div>
            <span className={small}>{say("extra_per")}</span>
            <div className="mt-1 flex gap-1 rounded-2xl bg-[var(--panel-secondary)] p-1" role="radiogroup">
              {(["day", "rental"] as const).map((per) => (
                <button aria-checked={draft.per === per} className={segment(draft.per === per)} key={per} onClick={() => change({ per })} role="radio" type="button">
                  {say(per === "day" ? "extra_perDay" : "extra_perRental")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={small}>{say("extra_for")}</span>
            <div className="mt-1 flex flex-wrap gap-1 rounded-2xl bg-[var(--panel-secondary)] p-1" role="radiogroup">
              <button aria-checked={scope === "all"} className={segment(scope === "all")} onClick={() => { setError(null); setScope("all"); }} role="radio" type="button">
                {say("extra_forAll")}
              </button>
              {scope === "kind" ? (
                <button aria-checked className={segment(true)} role="radio" type="button">
                  {say(draft.kind === "bike" ? "extra_forBikes" : "extra_forCars")}
                </button>
              ) : null}
              <button aria-checked={scope === "chosen"} className={segment(scope === "chosen")} onClick={() => { setError(null); setScope("chosen"); }} role="radio" type="button">
                {say("extra_forChosen")}
              </button>
            </div>
            {scope === "chosen" ? (
              sortedVehicles.length ? (
                <ul className="mt-2 max-h-56 divide-y divide-[var(--border)] overflow-y-auto rounded-xl border border-[var(--border)]">
                  {sortedVehicles.map((vehicle) => (
                    <li key={vehicle.id}>
                      <label className="flex min-h-11 items-center gap-3 px-3 py-2">
                        <input
                          checked={chosen.has(vehicle.id)}
                          onChange={(event) => {
                            const next = new Set(chosen);
                            if (event.target.checked) next.add(vehicle.id);
                            else next.delete(vehicle.id);
                            change({ vehicleIds: [...next] });
                          }}
                          type="checkbox"
                        />
                        <span className="min-w-0 flex-1 truncate font-semibold text-[var(--foreground)]">{vehicle.name}</span>
                        {vehicle.plate ? <span className="shrink-0 text-[13px] font-medium text-[var(--muted)]">{vehicle.plate}</span> : null}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[14px] font-medium text-[var(--muted)]">{say("extra_noVehicles")}</p>
              )
            ) : null}
          </div>
          {/* A ready-made extra's own detail: the lower excess, the age, the countries allowed. */}
          {draft.preset === "damage_waiver" ? (
            <label className="block">
              <span className={small}>
                {say("xp_excess", { symbol: currencySymbol })} <InfoTip label={say("xp_excess", { symbol: currencySymbol })} text={say("xp_excessTip")} />
              </span>
              {/* The symbol inside the box, like the price above (7 Nov 2026). */}
              <span className="relative mt-1 block">
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-3 flex items-center font-semibold text-[var(--foreground-secondary)]">
                  {currencySymbol}
                </span>
                <input
                  className="w-full"
                  inputMode="numeric"
                  onChange={(event) => change({ excess: Number(event.target.value.replace(/[^\d]/g, "")) || 0 })}
                  placeholder="0"
                  style={{ paddingInlineStart: `calc(1.25rem + ${Math.max(1, currencySymbol.length)}ch)` }}
                  value={draft.excess ? String(draft.excess) : ""}
                />
              </span>
            </label>
          ) : null}
          {draft.preset === "young_driver" ? (
            <label className="block">
              <span className={small}>{say("xp_minAge")}</span>
              <input className={field} inputMode="numeric" onChange={(event) => change({ minAge: Number(event.target.value.replace(/[^\d]/g, "")) || 0 })} value={draft.minAge ? String(draft.minAge) : ""} />
            </label>
          ) : null}
          {draft.preset === "cross_border" ? (
            <label className="block">
              <span className={small}>{say("xp_countries")}</span>
              <input className={field} maxLength={200} onChange={(event) => change({ countries: event.target.value })} placeholder={say("xp_countriesPh")} value={draft.countries || ""} />
            </label>
          ) : null}
          {error ? <p className="text-[14px] font-semibold text-[var(--danger)]" role="alert">{error}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button className="primary-action pressable" disabled={pending} onClick={save} type="button">
            {pending ? say("saving") : say("save")}
          </button>
          <button className="secondary-action pressable" disabled={pending} onClick={onClose} type="button">
            {say("cancel")}
          </button>
          {!isNew ? (
            confirmDelete ? (
              <button
                className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--danger)] px-3 font-semibold text-white"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const failed = await onDelete();
                    if (failed) setError(failed);
                  })
                }
                type="button"
              >
                <Trash2 size={16} />
                {say("extra_deleteSure")}
              </button>
            ) : (
              <button className="ms-auto inline-flex min-h-11 items-center gap-1.5 px-2 font-semibold text-[var(--danger)]" disabled={pending} onClick={() => setConfirmDelete(true)} type="button">
                <Trash2 size={16} />
                {say("extra_delete")}
              </button>
            )
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
