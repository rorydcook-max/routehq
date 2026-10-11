"use client";

import { Check, Copy, Loader2, Search, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { longDate, shortDate } from "@/lib/i18n/dates";
import { markFeePaid, searchPartnerVehicles, sendReferral } from "@/app/actions/partners";
import { priceFor, type PartnerVehicle, type ReferralRow } from "@/lib/partner-pricing";

type Say = (key: string, values?: Record<string, string | number>) => string;

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-[15px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

const KINDS = ["any", "car", "scooter", "motorbike", "van", "atv", "ebike"];

function baht(value: number, currency = "THB") {
  return `${currency === "THB" ? "฿" : `${currency} `}${Math.round(value).toLocaleString("en-US")}`;
}

export function PartnersView({ referrals, today }: { referrals: ReferralRow[]; today: string }) {
  const t = useTranslations("partners") as unknown as Say;
  const c = useTranslations("common") as unknown as Say;
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [kind, setKind] = useState("any");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PartnerVehicle[] | null>(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<PartnerVehicle | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ bookingUrl: string; partner: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [paid, setPaid] = useState<Set<string>>(new Set());

  async function search() {
    setSearching(true);
    setError("");
    setPicked(null);
    setSent(null);
    const result = await searchPartnerVehicles({ startDate, endDate: endDate || null, kind });
    if (result.ok) setResults(result.vehicles);
    else setError(result.error);
    setSearching(false);
  }

  async function send() {
    if (!picked) return;
    setSending(true);
    setError("");
    const result = await sendReferral({ vehicleId: picked.vehicleId, startDate, endDate: endDate || null, customerName, customerPhone, baseUrl: window.location.origin });
    if (result.ok) setSent({ bookingUrl: result.bookingUrl, partner: result.partner });
    else setError(result.error);
    setSending(false);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The link is on screen to select by hand.
    }
  }

  async function payFee(id: string) {
    setPaying(id);
    const result = await markFeePaid({ referralId: id, method: "bank_transfer" });
    if (result.ok) setPaid((current) => new Set([...current, id]));
    else setError(result.error);
    setPaying(null);
  }

  const whatsapp = (phone: string, text: string) => {
    const digits = phone.replace(/\D/g, "");
    const to = digits.startsWith("0") ? `66${digits.slice(1)}` : digits;
    return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
  };

  const sentRows = referrals.filter((row) => row.direction === "sent");
  const receivedRows = referrals.filter((row) => row.direction === "received");
  const owed = receivedRows.filter((row) => row.feeAmount && !row.feePaidAt && !paid.has(row.id));

  return (
    <div className="space-y-4">
      {/* 1. What the customer wants */}
      <section className="card p-4">
        <h2 className="text-[17px] font-bold text-[var(--foreground)]">{t("findTitle")}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("findBody")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
            {t("from")}
            <input className={inputClass} min={today} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
          </label>
          <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
            {t("to")} <span className="font-medium text-[var(--muted)]">· {t("toOptional")}</span>
            <input className={inputClass} min={startDate} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
          </label>
          <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
            {t("kind")}
            <select className={inputClass} onChange={(event) => setKind(event.target.value)} value={kind}>
              {KINDS.map((value) => (
                <option key={value} value={value}>
                  {value === "any" ? t("anyKind") : c(`kinds_${value}`)}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-action pressable self-end" disabled={searching || !startDate} onClick={search} type="button">
            {searching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            {t("search")}
          </button>
        </div>
        {error ? <p className="mt-3 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
      </section>

      {/* 2. What partners have free */}
      {results ? (
        <section className="card p-4">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{results.length ? t("freeTitle", { count: results.length }) : t("noneTitle")}</h2>
          {!results.length ? <p className="mt-1 text-sm text-[var(--muted)]">{t("noneBody")}</p> : null}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {results.map((vehicle) => {
              const price = priceFor(vehicle, startDate, endDate || null);
              const chosen = picked?.vehicleId === vehicle.vehicleId;
              return (
                <div className={`rounded-xl border p-3 ${chosen ? "border-[var(--primary)] ring-2 ring-[var(--focus-ring)]" : "border-[var(--border)]"}`} key={vehicle.vehicleId}>
                  <p className="text-[16px] font-bold text-[var(--foreground)]">
                    {vehicle.make} {vehicle.model} {vehicle.year ? <span className="font-medium text-[var(--muted)]">{vehicle.year}</span> : null}
                  </p>
                  <p className="text-sm font-semibold text-[var(--foreground-secondary)]">
                    {vehicle.business}
                    {vehicle.town ? ` · ${vehicle.town}` : ""}
                  </p>
                  <p className="mt-2 text-[15px] font-bold text-[var(--foreground)]">
                    {baht(price.rate, vehicle.currency)} {t(`per_${price.model}`)}
                    {price.days ? <span className="font-medium text-[var(--muted)]"> · {t("forDays", { total: baht(price.total, vehicle.currency), days: price.days })}</span> : null}
                  </p>
                  <p className="text-sm text-[var(--muted)]">{t("deposit", { amount: baht(vehicle.deposit, vehicle.currency) })}</p>
                  <button
                    className={`${chosen ? "primary-action" : "secondary-action"} pressable mt-3 min-h-10 px-3 text-sm`}
                    onClick={() => {
                      setPicked(vehicle);
                      setSent(null);
                    }}
                    type="button"
                  >
                    {chosen ? <Check size={15} /> : null}
                    {chosen ? t("chosen") : t("choose")}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 3. Send the customer */}
      {picked && !sent ? (
        <section className="card p-4">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{t("sendTitle", { vehicle: `${picked.make} ${picked.model}`, partner: picked.business })}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("sendBody")}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
              {t("customerName")}
              <input className={inputClass} onChange={(event) => setCustomerName(event.target.value)} value={customerName} />
            </label>
            <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
              {t("customerPhone")}
              <input className={inputClass} inputMode="tel" onChange={(event) => setCustomerPhone(event.target.value)} value={customerPhone} />
            </label>
          </div>
          <button className="primary-action pressable mt-4" disabled={sending || !customerName.trim()} onClick={send} type="button">
            {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            {t("sendButton")}
          </button>
        </section>
      ) : null}

      {sent ? (
        <section className="card border border-[var(--success-line)] bg-[var(--success-light)] p-4">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{t("sentTitle", { partner: sent.partner })}</h2>
          <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{t("sentBody")}</p>
          <p className="mt-3 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm text-[var(--foreground)]">{sent.bookingUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="secondary-action pressable" onClick={() => copy(sent.bookingUrl)} type="button">
              <Copy size={15} /> {copied ? t("copied") : t("copyLink")}
            </button>
            {customerPhone ? (
              <a className="primary-action pressable" href={whatsapp(customerPhone, t("whatsappText", { partner: sent.partner, url: sent.bookingUrl }))} rel="noreferrer" target="_blank">
                {t("sendWhatsapp")}
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 4. Fees */}
      {owed.length ? (
        <section className="card border border-[var(--warning-line)] bg-[var(--warning-light)] p-4">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{t("owedTitle", { count: owed.length })}</h2>
          <ul className="mt-2 space-y-2">
            {owed.map((row) => (
              <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2" key={row.id}>
                <span className="font-medium text-[var(--foreground)]">
                  {baht(row.feeAmount || 0)} {t("toPartner", { partner: row.partner })} · {row.customerName || t("aCustomer")}
                  {row.feeDueAt ? <span className="text-[var(--muted)]"> · {t("by", { date: row.feeDueAt })}</span> : null}
                </span>
                <button className="secondary-action pressable min-h-10 px-3 text-sm" disabled={paying === row.id} onClick={() => payFee(row.id)} type="button">
                  {paying === row.id ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} {t("markPaid")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ReferralList emptyKey="sentEmpty" rows={sentRows} paid={paid} t={t} titleKey="sentListTitle" />
        <ReferralList emptyKey="receivedEmpty" rows={receivedRows} paid={paid} t={t} titleKey="receivedListTitle" />
      </div>
    </div>
  );
}

function ReferralList({ rows, paid, t, titleKey, emptyKey }: { rows: ReferralRow[]; paid: Set<string>; t: Say; titleKey: string; emptyKey: string }) {
  const locale = useLocale();
  const stage = (row: ReferralRow) => {
    if (row.status === "cancelled" || row.rentalStatus === "cancelled") return t("st_cancelled");
    if (row.rentalStatus && ["active", "due_soon", "overdue", "extended", "completed"].includes(row.rentalStatus)) return t("st_rented");
    if (row.rentalStatus === "booked") return t("st_booked");
    return t("st_sent");
  };
  return (
    <section className="card p-4">
      <h2 className="text-[17px] font-bold text-[var(--foreground)]">{t(titleKey)}</h2>
      {rows.length ? (
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {rows.map((row) => {
            const feePaid = Boolean(row.feePaidAt) || paid.has(row.id);
            return (
              <li className="py-2.5" key={row.id}>
                <p className="font-semibold text-[var(--foreground)]">
                  {row.customerName || t("aCustomer")} <span className="font-medium text-[var(--muted)]">· {row.vehicle}</span>
                </p>
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {row.direction === "sent" ? t("toPartner", { partner: row.partner }) : t("fromPartner", { partner: row.partner })} · {row.endDate ? `${shortDate(row.startDate, locale)} – ${longDate(row.endDate, locale)}` : longDate(row.startDate, locale)} · {stage(row)}
                </p>
                <p className="text-sm font-semibold">
                  {row.feeAmount ? (
                    <span className={feePaid ? "text-[var(--success)]" : "text-[var(--warning)]"}>
                      {t("fee", { amount: `฿${Math.round(row.feeAmount).toLocaleString("en-US")}`, pct: row.feePct })} · {feePaid ? t("feePaid") : t("feeUnpaid")}
                    </span>
                  ) : (
                    <span className="text-[var(--muted)]">{t("feePending", { pct: row.feePct })}</span>
                  )}
                  {row.direction === "received" && row.rentalId ? (
                    <Link className="ml-2 font-bold text-[var(--primary)]" href={`/bookings/${row.rentalId}`}>
                      {t("openBooking")}
                    </Link>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-[var(--muted)]">{t(emptyKey)}</p>
      )}
    </section>
  );
}
