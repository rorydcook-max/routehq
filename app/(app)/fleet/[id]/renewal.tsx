"use client";

import { InfoTip } from "@/components/info-tip";
import { useEffect, useRef, useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { monthsCovered } from "@/lib/cost-spread";
import { dateFormat } from "@/lib/i18n/dates";
import { Camera, Check, Copy, ExternalLink, Loader2, ShieldCheck, X } from "lucide-react";
import type { InsurancePartner } from "@/lib/insurance-partners";
import { renewVehicleComplianceFromForm } from "@/app/actions/vehicles";
import { PendingButton } from "@/components/pending-button";
import { ActionForm } from "@/components/action-form";

type Say = (key: string, values?: Record<string, string | number>) => string;
const inputClass = "mt-1 w-full";
const labelClass = "font-semibold text-[var(--foreground-secondary)]";

/** Renewed it: a photo of the new certificate, policy or tax receipt fills the date and cost in; the photo is kept. */
export function RenewalForm({
  vehicleId,
  organizationId,
  complianceType,
  readable,
  paperwork = false,
  currentExpiry = null,
  today = "",
  currency = "THB",
  inspection
}: {
  /** An inspection done with this renewal (Thailand's ตรอ. with road tax): its local name; its cost is asked for too. */
  inspection?: string;
  vehicleId: string;
  organizationId: string;
  complianceType: string;
  readable: boolean;
  /** Tax, insurance, inspection: a cost, paid once for the cover or every month. */
  paperwork?: boolean;
  /** The date saved now: a renewal's cover usually starts the day the old one runs out. */
  currentExpiry?: string | null;
  today?: string;
  currency?: string;
}) {
  const t = useTranslations("vehiclePage");
  const say = t as unknown as Say;
  const locale = useLocale();
  const fileInput = useRef<HTMLInputElement>(null);
  // The old date when it is recent or still ahead (renewing on time), else today (catching up on a lapsed one).
  const [coverStart, setCoverStart] = useState(() => {
    const old = String(currentExpiry || "").slice(0, 10);
    const recent = today ? new Date(Date.parse(`${today}T00:00:00Z`) - 60 * 86_400_000).toISOString().slice(0, 10) : "";
    return old && old >= recent ? old : today;
  });
  // The same day a year later: where cover usually ends. Filled in from the start date until someone types their own.
  const yearOn = (day: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCFullYear(date.getUTCFullYear() + 1);
    return date.toISOString().slice(0, 10);
  };
  const [expiry, setExpiry] = useState(() => (paperwork ? yearOn(coverStart) : ""));
  const [mode, setMode] = useState<"once" | "monthly">("once");
  // Paid monthly but not every month (10 payments for a year's cover, say): how many payments there are.
  const [payments, setPayments] = useState("");
  // To the cent or satang: ฿877.78 a month is not ฿878.
  const amountText = (value: number) => {
    const exact = Math.round(value * 100) / 100;
    const whole = Math.abs(exact - Math.round(exact)) < 0.005;
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(exact);
    } catch {
      return `${currency} ${exact.toLocaleString("en-US")}`;
    }
  };
  const dateText = (day: string) => {
    try {
      return dateFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
    } catch {
      return day;
    }
  };
  const [cost, setCost] = useState("");
  // Bumped when the photo fills the cost in, so the money box shows it.
  const [costStamp, setCostStamp] = useState(0);
  const [notes, setNotes] = useState("");
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  async function read(file: File) {
    if (!readable || !file.type.startsWith("image/") && file.type !== "application/pdf") return;
    setReading(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("type", complianceType);
      const response = await fetch("/api/ocr/renewal", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.expiryDate) {
        setMessage({ tone: "bad", text: data.error || say("rn_readNoDate") });
        return;
      }
      setExpiry(data.expiryDate);
      if (paperwork && data.startDate && data.startDate < data.expiryDate) setCoverStart(data.startDate);
      if (data.cost) { setCost(String(data.cost)); setCostStamp((n) => n + 1); }
      if (!notes) setNotes([data.provider, data.policyNumber].filter(Boolean).join(" · "));
      setMessage({ tone: "ok", text: say("rn_readDone") });
    } catch {
      setMessage({ tone: "bad", text: say("rn_readNoDate") });
    } finally {
      setReading(false);
    }
  }

  return (
    <ActionForm action={renewVehicleComplianceFromForm} className="mt-3 grid gap-3 sm:grid-cols-2">
      <input name="vehicleId" type="hidden" value={vehicleId} />
      <input name="organizationId" type="hidden" value={organizationId} />
      <input name="complianceType" type="hidden" value={complianceType} />
      <label className="block sm:col-span-2">
        <span className={labelClass}>{say("f_docPhoto")}</span>
        <input
          accept="image/*,application/pdf"
          className="mt-1 w-full"
          name="documentFile"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void read(file);
          }}
          ref={fileInput}
          type="file"
        />
        {readable && reading ? (
          <span className="mt-1 flex items-start gap-1.5 text-[14px] font-medium text-[var(--muted)]">
            <Loader2 aria-hidden="true" className="mt-0.5 shrink-0 animate-spin" size={16} />
            {say("rn_reading")}
          </span>
        ) : null}
        {message ? <span className={`mt-1 block text-[14px] font-semibold ${message.tone === "ok" ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{message.text}</span> : null}
      </label>
      {paperwork ? (
        <label className="block">
          <span className={labelClass}>{say("f_coverStarts")}</span>
          <input
            className={inputClass}
            name="coverStart"
            onChange={(event) => {
              const start = event.target.value;
              if (start && (!expiry || expiry === yearOn(coverStart))) setExpiry(yearOn(start));
              setCoverStart(start);
            }}
            type="date"
            value={coverStart}
          />
        </label>
      ) : null}
      <label className="block">
        <span className={labelClass}>{say("f_runsOutOn")}</span>
        <input className={inputClass} name="newExpiryDate" onChange={(event) => setExpiry(event.target.value)} required type="date" value={expiry} />
      </label>
      {paperwork ? (
        <fieldset className="block sm:col-span-2">
          <legend className={labelClass}>{say("f_howPaid")}</legend>
          <input name="paymentMode" type="hidden" value={mode} />
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(["once", "monthly"] as const).map((option) => (
              <button
                aria-pressed={mode === option}
                className={`pressable min-h-11 rounded-xl border px-3 text-[15px] font-bold ${mode === option ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
                key={option}
                onClick={() => setMode(option)}
                type="button"
              >
                {say(option === "once" ? "f_paidOnce" : "f_paidMonthly")}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <label className={`block ${paperwork ? "sm:col-span-2" : ""}`}>
        <span className={labelClass}>{say(paperwork && mode === "monthly" ? "f_costMonthly" : "f_cost")}</span>
        <MoneyInput currency={currency} defaultValue={cost} key={costStamp} name="cost" onValueChange={setCost} />
        {(() => {
          // What it adds to the costs each month, so the owner sees a yearly bill as 1/12 a month.
          const amount = Number(String(cost).replace(/,/g, ""));
          if (!paperwork || !(amount > 0) || !expiry) return null;
          if (mode === "monthly" && Number(payments) >= 1) return <span className="mt-1 block text-[14px] font-medium text-[var(--muted)]">{say("f_monthlyCountHint", { amount: amountText(amount), count: Math.floor(Number(payments)), date: dateText(coverStart || today) })}</span>;
          if (mode === "monthly") return <span className="mt-1 block text-[14px] font-medium text-[var(--muted)]">{say("f_monthlyHint", { amount: amountText(amount), date: dateText(expiry) })}</span>;
          const from = coverStart || today;
          if (!from || expiry <= from) return null;
          const months = monthsCovered({ from, to: expiry });
          return months >= 2 ? <span className="mt-1 block text-[14px] font-medium text-[var(--muted)]">{say("f_spreadHint", { amount: amountText(amount / months), months })}</span> : null;
        })()}
      </label>
      {paperwork && mode === "monthly" ? (
        <label className="block sm:col-span-2">
          <span className={`${labelClass} inline-flex items-center gap-1.5`}>
            {say("f_payments")}
            <InfoTip label={say("f_payments")} text={say("f_paymentsHint")} />
          </span>
          <input
            className={inputClass}
            inputMode="numeric"
            max={36}
            min={1}
            name="payments"
            onChange={(event) => setPayments(event.target.value)}
            placeholder={coverStart && expiry > coverStart ? String(monthsCovered({ from: coverStart, to: expiry })) : "12"}
            type="number"
            value={payments}
          />
        </label>
      ) : null}
      {inspection ? (
        <label className="block sm:col-span-2">
          <span className={`${labelClass} inline-flex items-center gap-1.5`}>
            {say("f_inspectionCost", { name: inspection })}
            <InfoTip label={say("f_inspectionCost", { name: inspection })} text={say("f_inspectionHint")} />
          </span>
          <MoneyInput currency={currency} name="inspectionCost" />
        </label>
      ) : null}
      <label className="block sm:col-span-2">
        <span className={labelClass}>{say("f_notes")}</span>
        <input className={inputClass} name="notes" onChange={(event) => setNotes(event.target.value)} value={notes} />
      </label>
      <PendingButton className="primary-action sm:col-span-2" pendingLabel={say("saving")} type="submit">
        {say("save")}
      </PendingButton>
    </ActionForm>
  );
}

/**
 * How to renew road tax, Por Ror Bor or insurance, for this vehicle. Plain guidance and the official DLT link only:
 * RoveHQ isn't a licensed insurance broker, so it doesn't link to insurers or take a cut (OIC rules, July 2026).
 */
export function RenewalHelp({
  kind,
  vehicleAge,
  twoWheeler,
  porborDaysLeft,
  details,
  partner = null
}: {
  kind: "tax" | "porbor" | "insurance";
  /** Whole years since the vehicle was first registered; null when the year isn't saved. */
  vehicleAge: number | null;
  twoWheeler: boolean;
  porborDaysLeft: number | null;
  /** Plate, model, year, chassis number...: what an insurer or the DLT asks for. */
  details: string;
  /** A licensed broker partner's quote page for this vehicle, when one is signed up (lib/insurance-partners.ts). */
  partner?: InsurancePartner | null;
}) {
  const t = useTranslations("vehiclePage");
  const say = t as unknown as Say;
  const [copied, setCopied] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  // The quote opens over the whole app (drawn on the page body, above the bottom bar); the page behind doesn't scroll.
  useEffect(() => {
    if (!quoteOpen) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setQuoteOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [quoteOpen]);
  const licence = partner?.licence ? say("pq_licence", { licence: partner.licence }) : "";
  const inspectionAge = twoWheeler ? 5 : 7;
  const needsInspection = vehicleAge !== null && vehicleAge > inspectionAge;
  const steps: string[] = [];
  if (kind === "tax") {
    if (porborDaysLeft !== null && porborDaysLeft <= 90) steps.push(say("rn_taxPorborFirst"));
    steps.push(needsInspection ? say("rn_taxInspection", { years: inspectionAge }) : vehicleAge === null ? say("rn_taxAgeUnknown", { car: 7, bike: 5 }) : say("rn_taxOnline"));
    steps.push(say("rn_taxGreenPlate"));
    steps.push(say("rn_taxBring"));
  } else if (kind === "porbor") {
    steps.push(say("rn_porborRental"));
    steps.push(say("rn_porborBeforeTax"));
    steps.push(say("rn_porborWhere"));
  } else {
    steps.push(say("rn_insRental"));
    steps.push(say("rn_insCompare"));
    steps.push(say("rn_insClaims"));
  }

  // A signed partner: quotes right here, the partner's page and licence, RoveHQ named as not a broker.
  const quoteBox = partner ? (
    <div className="mt-2.5 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary-light)] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <ShieldCheck aria-hidden="true" className="shrink-0 text-[var(--primary)]" size={22} />
        <div className="min-w-[10rem] flex-1">
          <p className="font-bold text-[var(--foreground)]">{say(kind === "porbor" ? "pq_titlePorbor" : "pq_title", { partner: partner.name })}</p>
        </div>
        {partner.embed ? (
          <button className="primary-action pressable w-full justify-center sm:w-auto" onClick={() => setQuoteOpen(true)} type="button">
            {say("pq_open")}
          </button>
        ) : (
          <a className="primary-action pressable w-full justify-center sm:w-auto" href={partner.url} rel="noopener" target="_blank">
            <ExternalLink aria-hidden="true" size={16} />
            {say("pq_open")}
          </a>
        )}
      </div>
      <p className="mt-2 text-[12px] leading-snug text-[var(--muted)]">{say("pq_disclosure", { partner: partner.name, licence })}</p>
    </div>
  ) : null;

  return (
    <>
    {quoteBox}
    {quoteOpen && partner ? createPortal(
      <div aria-modal="true" className="fixed inset-0 z-[1000] flex flex-col bg-black/50 sm:p-6" role="dialog">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white sm:mx-auto sm:w-full sm:max-w-3xl sm:rounded-2xl">
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-[var(--foreground)]">{say(kind === "porbor" ? "pq_titlePorbor" : "pq_title", { partner: partner.name })}</p>
              <p className="line-clamp-2 text-[12px] leading-snug text-[var(--muted)]">{say("pq_frameNote", { partner: partner.name, licence })}</p>
            </div>
            <a aria-label={say("pq_newTab")} className="secondary-action pressable min-h-9 shrink-0 px-3 text-[14px]" href={partner.url} rel="noopener" target="_blank">
              <ExternalLink aria-hidden="true" size={15} />
              <span className="hidden sm:inline">{say("pq_newTab")}</span>
            </a>
            <button aria-label={say("pq_close")} className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-[var(--panel-secondary)]" onClick={() => setQuoteOpen(false)} type="button">
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          <iframe className="min-h-0 w-full flex-1 border-0" referrerPolicy="strict-origin-when-cross-origin" src={partner.url} title={partner.name} />
        </div>
      </div>,
      document.body
    ) : null}
    <details className="mt-2.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2">
      <summary className="cursor-pointer font-bold text-[var(--primary)]">{say("rn_how")}</summary>
      <ul className="mt-2 space-y-1.5">
        {steps.map((step) => (
          <li className="flex gap-2 text-[15px] font-medium text-[var(--foreground-secondary)]" key={step}>
            <Check aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--primary)]" size={16} />
            <span>{step}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="secondary-action pressable min-h-9 px-3 text-[14px]"
          onClick={() => {
            navigator.clipboard
              ?.writeText(details)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
              .catch(() => null);
          }}
          type="button"
        >
          <Copy aria-hidden="true" size={15} />
          {copied ? say("rn_copied") : kind === "tax" ? say("rn_copyDetails") : say("rn_copyForInsurer")}
        </button>
        {kind === "tax" ? (
          <a className="secondary-action pressable min-h-9 px-3 text-[14px]" href="https://eservice.dlt.go.th" rel="noreferrer" target="_blank">
            <ExternalLink aria-hidden="true" size={15} />
            {say("rn_dltLink")}
          </a>
        ) : null}
      </div>
      <p className="mt-2 text-[13px] text-[var(--muted)]">{say("rn_disclaimer")}</p>
    </details>
    </>
  );
}
