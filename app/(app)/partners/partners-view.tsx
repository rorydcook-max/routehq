"use client";

import { Car, Check, Copy, Loader2, MapPin, Search, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { longDate, shortDate } from "@/lib/i18n/dates";
import { formatDistance, formatMoney, fromKm, type DistanceUnit } from "@/lib/regional";
import { markReferralSettled, savePartnerNetwork, searchPartnerVehicles } from "@/app/actions/partners";
import { MoneyInput } from "@/components/money-input";
import { PlaceField, type PickedPlace } from "@/components/place-field";
import { SwitchField } from "@/components/switch-field";
import { InfoTip } from "@/components/info-tip";
import type { PartnerVehicle, ReferralRow } from "@/lib/partner-pricing";
import { searchPlaces } from "@/lib/place-coords";
import { CAR_SIZES, ENGINE_BANDS, ENGINE_KINDS } from "@/lib/vehicle-filters";

type Say = (key: string, values?: Record<string, string | number>) => string;

// The global field style (44px, regular weight), so these line up with the Search button beside them.
const inputClass = "mt-1 w-full";
const labelClass = "block text-sm font-semibold text-[var(--foreground-secondary)]";
const KINDS = ["car", "scooter", "motorbike", "van", "atv", "ebike"];
const PERIODS: Array<{ key: string; days: number | null }> = [
  { key: "p_day", days: 1 },
  { key: "p_week", days: 7 },
  { key: "p_2weeks", days: 14 },
  { key: "p_month", days: 30 },
  { key: "p_open", days: null }
];

const money = (amount: number, currency: string) => formatMoney(amount, currency, "en-US");

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Amounts per currency, e.g. "฿1,200 + €40". */
function totals(rows: ReferralRow[]) {
  const sums = new Map<string, number>();
  for (const row of rows) if (row.feeOpen > 0) sums.set(row.currency, (sums.get(row.currency) || 0) + row.feeOpen);
  return [...sums.entries()].map(([currency, amount]) => money(amount, currency));
}

export function PartnersView({
  sharing: initialSharing,
  blocked,
  canEdit,
  canSettle,
  referrals,
  country,
  defaultPlace,
  currency,
  pct,
  today
}: {
  sharing: boolean;
  blocked: string[];
  canEdit: boolean;
  canSettle: boolean;
  referrals: ReferralRow[];
  country: string;
  defaultPlace: PickedPlace | null;
  currency: string;
  pct: number;
  today: string;
}) {
  const t = useTranslations("partners") as unknown as Say;
  const c = useTranslations("common") as unknown as Say;
  const router = useRouter();
  const [sharing, setSharing] = useState(initialSharing);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, startSaving] = useTransition();

  const [place, setPlace] = useState<PickedPlace | null>(defaultPlace);
  const [placeText, setPlaceText] = useState(defaultPlace?.name || "");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, 7));
  const [kind, setKind] = useState("any");
  const [size, setSize] = useState("");
  const [engine, setEngine] = useState("");
  const [gearbox, setGearbox] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PartnerVehicle[] | null>(null);
  const [resultCurrency, setResultCurrency] = useState(currency);
  const [unit, setUnit] = useState<DistanceUnit>("km");
  const [searched, setSearched] = useState<{ startDate: string; endDate: string | null } | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [fallbackLink, setFallbackLink] = useState<{ id: string; url: string } | null>(null);

  const kinds = useMemo(() => [...KINDS].sort((a, b) => c(`kinds_${a}`).localeCompare(c(`kinds_${b}`))), [c]);
  const sizes = useMemo(() => [...CAR_SIZES].sort((a, b) => t(`size_${a}`).localeCompare(t(`size_${b}`))), [t]);
  const gearboxes = useMemo(() => ["auto", "manual"].sort((a, b) => t(`gear_${a}`).localeCompare(t(`gear_${b}`))), [t]);
  const showSize = kind === "car";
  const showEngine = ENGINE_KINDS.includes(kind);
  const distance = (km: number) => formatDistance(Math.round(fromKm(km, unit) * 10) / 10, unit, "en-US");
  /** "Automatic · 5 seats · 125 cc", from what the operator recorded. */
  const details = (vehicle: PartnerVehicle) =>
    [
      vehicle.gearbox ? t(`gear_${vehicle.gearbox}`) : null,
      vehicle.seats && vehicle.kind !== "scooter" && vehicle.kind !== "motorbike" ? t("seatsN", { count: vehicle.seats }) : null,
      vehicle.engineCc && ENGINE_KINDS.includes(vehicle.kind) ? t("ccN", { cc: vehicle.engineCc.toLocaleString("en-US") }) : null
    ]
      .filter(Boolean)
      .join(" · ");

  function toggleSharing(next: boolean) {
    setSharing(next);
    setSaveFailed(false);
    startSaving(async () => {
      const result = await savePartnerNetwork({ enabled: next, blocked }).catch(() => ({ ok: false as const }));
      if (!result.ok) {
        setSharing(!next);
        setSaveFailed(true);
        return;
      }
      if (!next) setResults(null);
      router.refresh();
    });
  }

  async function search() {
    setSearching(true);
    setError("");
    setFallbackLink(null);
    // Typed but not picked: the best suggestion, so "lamai" + Search just works. Nothing typed: anywhere.
    let point = place;
    if (!point && placeText.trim()) {
      const best = searchPlaces(placeText, { country, limit: 1 })[0];
      if (!best) {
        setError(t("placeUnknown"));
        setSearching(false);
        return;
      }
      point = { name: best.name, region: best.region, lat: best.lat, lng: best.lng };
      setPlace(point);
    }
    const budgetValue = Number(budgetInput);
    const result = await searchPartnerVehicles({
      startDate,
      endDate: endDate || null,
      kind,
      size: showSize ? size || null : null,
      engine: showEngine ? engine || null : null,
      gearbox: gearbox || null,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      maxPerDay: budgetValue > 0 ? budgetValue : null
    }).catch(() => null);
    if (result?.ok) {
      setResults(result.vehicles);
      setResultCurrency(result.currency);
      setUnit(result.unit);
      setSearched({ startDate, endDate: endDate || null });
      setBudget(null);
    } else setError(result && !result.ok ? result.error : t("searchFailed"));
    setSearching(false);
  }

  async function copy(vehicle: PartnerVehicle) {
    try {
      await navigator.clipboard.writeText(vehicle.bookingUrl);
      setCopied(vehicle.vehicleId);
      setFallbackLink(null);
      setTimeout(() => setCopied((current) => (current === vehicle.vehicleId ? null : current)), 2500);
    } catch {
      // No clipboard (an old browser or a blocked permission): show the link to copy by hand.
      setFallbackLink({ id: vehicle.vehicleId, url: vehicle.bookingUrl });
    }
  }

  // Budget slider: price per day in this business's currency, from nothing up to the dearest result.
  const priced = (results || []).filter((vehicle) => vehicle.perDayMine !== null);
  const maxPerDay = priced.length ? Math.max(...priced.map((vehicle) => vehicle.perDayMine as number)) : 0;
  const step = maxPerDay > 2000 ? 100 : maxPerDay > 200 ? 10 : 1;
  const sliderMax = Math.max(step, Math.ceil(maxPerDay / step) * step);
  const limit = budget ?? sliderMax;
  const shown = (results || []).filter((vehicle) => vehicle.perDayMine === null || vehicle.perDayMine <= limit);
  const overBudget = (results?.length || 0) - shown.length;

  const sent = referrals.filter((row) => row.direction === "sent");
  const received = referrals.filter((row) => row.direction === "received");
  const owedToMe = totals(sent);
  const iOwe = totals(received);

  return (
    <div className="space-y-4">
      {/* 1. Share the fleet: the switch everything else depends on. */}
      <section className="card p-4">
        <SwitchField
          checked={sharing}
          disabled={saving || !canEdit}
          label={
            <>
              {t("shareTitle")} <InfoTip label={t("shareTitle")} text={t("shareBody")} />
            </>
          }
          onChange={(event) => toggleSharing(event.target.checked)}
        />
        {!canEdit ? <p className="mt-2 text-sm text-[var(--muted)]">{t("shareOwnerOnly")}</p> : null}
        {saveFailed ? <p className="mt-2 text-sm font-bold text-[var(--danger)]">{t("shareSaveFailed")}</p> : null}
      </section>

      {!sharing ? (
        // Only businesses that share can search: a friendly nudge, with how it works in three steps behind the (i).
        <section className="card p-5 lg:p-7">
          <h2 className="card-title">
            {t("joinTitle")}{" "}
            <InfoTip
              label={t("joinTitle")}
              text={
                <ol className="list-decimal space-y-1 ps-4">
                  <li>{t("step1")}</li>
                  <li>{t("step2")}</li>
                  <li>{t("step3", { pct })}</li>
                </ol>
              }
            />
          </h2>
          <p className="measure mt-1 font-medium text-[var(--foreground-secondary)]">{t("joinBody")}</p>
        </section>
      ) : (
        <>
          {/* 2. What the customer wants. */}
          <section className="card p-4">
            <h2 className="card-title">{t("searchTitle")}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className={labelClass} htmlFor="partner-place">
                  {t("where")}
                </label>
                <PlaceField
                  country={country}
                  initial={defaultPlace}
                  inputId="partner-place"
                  onPick={(picked, typed) => {
                    setPlace(picked);
                    setPlaceText(typed);
                  }}
                  placeholder={t("wherePh")}
                />
              </div>
              <label className={labelClass}>
                {t("startDate")}
                <input
                  className={inputClass}
                  min={today}
                  onChange={(event) => {
                    const next = event.target.value;
                    setStartDate(next);
                    if (endDate && endDate <= next) setEndDate(addDays(next, 1));
                  }}
                  type="date"
                  value={startDate}
                />
              </label>
              <label className={labelClass}>
                {t("endDate")}
                <input className={inputClass} min={addDays(startDate || today, 1)} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
              </label>
            </div>
            {/* Or pick a rental period: it sets the end date from the start date. Next to the dates it changes, not under Search. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("period")}</span>
              {PERIODS.map((period) => {
                const end = period.days === null ? "" : addDays(startDate || today, period.days);
                const active = endDate === end;
                return (
                  <button
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${active ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] text-[var(--foreground-secondary)]"}`}
                    key={period.key}
                    onClick={() => setEndDate(end)}
                    type="button"
                  >
                    {t(period.key)}
                  </button>
                );
              })}
            </div>
            {!endDate ? <p className="mt-2 text-sm text-[var(--muted)]">{t("endDateHint")}</p> : null}
            {/* What kind of vehicle, and the budget: all applied by the search itself. */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <label className={labelClass}>
                {t("vehicleType")}
                <select
                  className={inputClass}
                  onChange={(event) => {
                    setKind(event.target.value);
                    setSize("");
                    setEngine("");
                  }}
                  value={kind}
                >
                  <option value="any">{t("anyType")}</option>
                  {kinds.map((value) => (
                    <option key={value} value={value}>
                      {c(`kinds_${value}`)}
                    </option>
                  ))}
                </select>
              </label>
              {showSize ? (
                <label className={labelClass}>
                  {t("size")}
                  <select className={inputClass} onChange={(event) => setSize(event.target.value)} value={size}>
                    <option value="">{t("anySize")}</option>
                    {sizes.map((value) => (
                      <option key={value} value={value}>
                        {t(`size_${value}`)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : showEngine ? (
                <label className={labelClass}>
                  {t("engine")}
                  {/* Smallest to biggest engine reads better than A to Z here. */}
                  <select className={inputClass} onChange={(event) => setEngine(event.target.value)} value={engine}>
                    <option value="">{t("anyEngine")}</option>
                    {ENGINE_BANDS.map((value) => (
                      <option key={value} value={value}>
                        {t(`engine_${value}`)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className={labelClass}>
                {t("gearbox")}
                <select className={inputClass} onChange={(event) => setGearbox(event.target.value)} value={gearbox}>
                  <option value="">{t("anyGearbox")}</option>
                  {gearboxes.map((value) => (
                    <option key={value} value={value}>
                      {t(`gear_${value}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${labelClass} ${showSize || showEngine ? "" : "lg:col-span-2"}`}>
                {t("budgetField")}
                <MoneyInput className="mt-1" currency={currency} name="maxPerDay" onValueChange={setBudgetInput} />
              </label>
              <button className="primary-action pressable self-end sm:col-span-2 lg:col-span-1" disabled={searching || !startDate} onClick={search} type="button">
                {searching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                {t("searchButton")}
              </button>
            </div>
            {error ? <p className="mt-3 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
          </section>

          {/* 3. What partners have free. */}
          {results && searched ? (
            <section className="card p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="card-title">{results.length ? t("resultsTitle", { count: shown.length }) : t("noResultsTitle")}</h2>
                {priced.length > 1 ? (
                  <label className="block w-full text-sm font-semibold text-[var(--foreground-secondary)] sm:w-72">
                    {t("budget")}: <span className="text-[var(--foreground)]">{t("budgetUpTo", { amount: money(limit, resultCurrency) })}</span>
                    <input
                      aria-valuetext={money(limit, resultCurrency)}
                      className="mt-2 w-full accent-[var(--primary)]"
                      max={sliderMax}
                      min={0}
                      onChange={(event) => setBudget(Number(event.target.value))}
                      step={step}
                      type="range"
                      value={limit}
                    />
                  </label>
                ) : null}
              </div>
              {!results.length ? <p className="mt-1 text-sm text-[var(--muted)]">{t("noResultsBody")}</p> : null}
              {overBudget > 0 ? <p className="mt-1 text-sm text-[var(--muted)]">{t("budgetHidden", { count: overBudget })}</p> : null}
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((vehicle) => {
                  const foreign = vehicle.currency !== resultCurrency;
                  return (
                    <article className="overflow-hidden rounded-xl border border-[var(--border)]" key={vehicle.vehicleId}>
                      {vehicle.photoUrl ? (
                        // Signed storage links: a plain img, like the booking page.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={vehicle.name} className="aspect-[16/10] w-full bg-[var(--panel-secondary)] object-cover" loading="lazy" src={vehicle.photoUrl} />
                      ) : (
                        <div aria-label={t("noPhoto")} className="flex aspect-[16/10] w-full items-center justify-center bg-[var(--panel-secondary)] text-[var(--muted)]" role="img">
                          <Car size={36} />
                        </div>
                      )}
                      <div className="p-3">
                        <p className="text-[16px] font-bold text-[var(--foreground)]">
                          {vehicle.name} {vehicle.year ? <span className="font-medium text-[var(--muted)]">{vehicle.year}</span> : null}
                        </p>
                        <p className="text-sm font-semibold text-[var(--foreground-secondary)]">
                          {vehicle.business}
                          {vehicle.town ? ` · ${vehicle.town}` : ""}
                        </p>
                        {details(vehicle) ? <p className="text-sm text-[var(--muted)]">{details(vehicle)}</p> : null}
                        {vehicle.delivers === true ? (
                          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--success)]">
                            <Truck aria-hidden="true" size={15} />
                            {t("deliversToYou")}
                          </p>
                        ) : vehicle.delivers === false && vehicle.distanceKm !== null ? (
                          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground-secondary)]">
                            <MapPin aria-hidden="true" size={15} />
                            {vehicle.distanceKm < 1 ? t("pickupNear") : t("pickupAway", { distance: distance(vehicle.distanceKm) })}
                          </p>
                        ) : null}
                        <p className="mt-2 text-[15px] font-bold text-[var(--foreground)]">
                          {vehicle.days ? t("forDates", { total: money(vehicle.total, vehicle.currency), days: vehicle.days }) : t("perMonthOpen", { total: money(vehicle.total, vehicle.currency) })}
                        </p>
                        <p className="text-sm text-[var(--muted)]">
                          {t("perDay", { amount: money(vehicle.perDay, vehicle.currency) })}
                          {foreign ? (vehicle.perDayMine !== null ? ` · ${t("approx", { amount: money(vehicle.perDayMine, resultCurrency) })}` : ` · ${t("ownCurrency", { currency: vehicle.currency })}`) : null}
                        </p>
                        <button className="secondary-action pressable mt-3 min-h-11 w-full px-4" onClick={() => copy(vehicle)} type="button">
                          {copied === vehicle.vehicleId ? <Check size={15} /> : <Copy size={15} />}
                          {copied === vehicle.vehicleId ? t("linkCopied") : t("copyLink")}
                        </button>
                        {fallbackLink?.id === vehicle.vehicleId ? (
                          <label className="mt-2 block text-sm font-semibold text-[var(--foreground-secondary)]">
                            {t("copyFallback")}
                            <input className="mt-1 w-full font-mono text-xs" onFocus={(event) => event.target.select()} readOnly value={fallbackLink.url} />
                          </label>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* 4. Commissions: what partners owe this business, and what it owes them. */}
      {referrals.length || sharing ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card p-4">
              <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">{t("owedToYou")}</p>
              <p className="mt-1 text-[22px] font-bold text-[var(--success)]">{owedToMe.length ? owedToMe.join(" + ") : t("nothingOwed")}</p>
            </div>
            <div className="card p-4">
              <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">{t("youOwe")}</p>
              <p className={`mt-1 text-[22px] font-bold ${iOwe.length ? "text-[var(--warning)]" : "text-[var(--foreground)]"}`}>{iOwe.length ? iOwe.join(" + ") : t("nothingOwed")}</p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ReferralList canSettle={canSettle} rows={sent} t={t} title={t("referredByYou")} />
            <ReferralList canSettle={canSettle} rows={received} t={t} title={t("referredToYou")} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ReferralList({ rows, t, title, canSettle }: { rows: ReferralRow[]; t: Say; title: string; canSettle: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null);
  const stage = (row: ReferralRow) => {
    if (row.status === "cancelled" || row.rentalStatus === "cancelled") return t("st_cancelled");
    if (!row.rentalId) return row.channel === "link" ? t("st_notBooked") : t("st_sent");
    if (row.rentalStatus && ["active", "due_soon", "overdue", "extended", "completed"].includes(row.rentalStatus)) return t("st_rented");
    return t("st_booked");
  };

  async function settle(id: string) {
    setBusy(id);
    setFailed(null);
    const result = await markReferralSettled({ referralId: id }).catch(() => null);
    if (result?.ok) router.refresh();
    else setFailed({ id, message: result && !result.ok ? result.error : t("settleFailed") });
    setBusy(null);
  }

  return (
    <section className="card p-4">
      <h2 className="card-title">{title}</h2>
      {rows.length ? (
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <li className="py-3" key={row.id}>
              <p className="font-semibold text-[var(--foreground)]">
                {row.customerName || t("aCustomer")} {row.vehicle ? <span className="font-medium text-[var(--muted)]">· {row.vehicle}</span> : null}
              </p>
              <p className="text-sm text-[var(--foreground-secondary)]">
                {row.direction === "sent" ? t("rowSent", { partner: row.partner, pct: row.feePct }) : t("rowReceived", { partner: row.partner, pct: row.feePct })}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {row.startDate ? (row.endDate ? `${shortDate(row.startDate, locale)} – ${longDate(row.endDate, locale)}` : longDate(row.startDate, locale)) : null}
                {row.startDate ? " · " : ""}
                {stage(row)}
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {row.feeTotal > 0 ? (
                    <>
                      <span className="text-[var(--foreground)]">{t("commissionSoFar", { total: money(row.feeTotal, row.currency) })}</span>
                      {" · "}
                      {row.feeOpen > 0 ? (
                        <span className="text-[var(--warning)]">{t("openAmount", { amount: money(row.feeOpen, row.currency) })}</span>
                      ) : (
                        <span className="text-[var(--success)]">{t("allSettled")}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-[var(--muted)]">{t("noPaymentsYet")}</span>
                  )}
                  {row.direction === "received" && row.rentalId ? (
                    <Link className="ml-2 font-bold text-[var(--primary)]" href={`/bookings/${row.rentalId}`}>
                      {t("openBooking")}
                    </Link>
                  ) : null}
                </p>
                {row.feeOpen > 0 && canSettle ? (
                  <button className="secondary-action pressable min-h-11 px-4" disabled={busy === row.id} onClick={() => settle(row.id)} type="button">
                    {busy === row.id ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} {t("markSettled")}
                  </button>
                ) : null}
              </div>
              {row.commissions.length ? (
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer font-semibold text-[var(--primary)]">{t("paymentsShow", { count: row.commissions.length })}</summary>
                  <ul className="mt-1 space-y-0.5 text-[var(--foreground-secondary)]">
                    {row.commissions.map((item) => (
                      <li key={item.id}>
                        {shortDate(item.createdAt.slice(0, 10), locale)} · {t("paymentLine", { payment: money(item.paymentAmount, row.currency), fee: money(item.feeAmount, row.currency) })}
                        {item.settledAt ? <span className="text-[var(--success)]"> · {t("settledTag")}</span> : null}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {failed?.id === row.id ? <p className="mt-1 text-sm font-bold text-[var(--danger)]">{failed.message}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-[var(--muted)]">{t("noneYet")}</p>
      )}
      {/* Paid between the two businesses for now. Automatic settlement with Stripe Connect plugs in at noteReferralFee (lib/partner-network.ts). */}
    </section>
  );
}
