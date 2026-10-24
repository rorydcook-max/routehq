"use client";

import { customerDate } from "@/lib/i18n/customer-dates";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CheckCircle2, Loader2, Receipt } from "lucide-react";
import { readPaymentSlip, submitPaymentReceipt } from "@/app/actions/public-booking";
import type { PortalBundle, PortalPayment } from "@/lib/payment-receipts";
import type { SlipMatch } from "@/lib/slip-matching";

type Read = { amount: number | null; date: string | null; reference: string | null; paidBy: string | null } | null;
type Choice = { paymentId: string; covers: string[]; amount: number; name: string; due: string };
type Say = (key: string, values?: Record<string, string | number>) => string;

function money(amount: number, currency: string) {
  const value = amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return currency === "THB" ? `฿${value}` : `${currency} ${value}`;
}

/**
 * "Already paid? Send your slip": the customer sends the slip first, the page reads it and asks one question,
 * "Is this for October's rent?". One tap sends it to the business, the same as choosing the payment by hand.
 */
export function SlipMatcher({
  token,
  payments,
  bundle,
  organizationName,
  defaultMethod,
  shrink
}: {
  token: string;
  payments: PortalPayment[];
  bundle: PortalBundle | null;
  organizationName: string;
  defaultMethod: string;
  shrink: (file: File) => Promise<File>;
}) {
  const t = useTranslations("customer");
  const say = t as unknown as Say;
  const locale = useLocale();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "reading" | "ask" | "pick" | "sending" | "sent">("idle");
  const [read, setRead] = useState<Read>(null);
  const [match, setMatch] = useState<SlipMatch>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [notSlip, setNotSlip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currency = payments[0]?.currency || "THB";

  const nameOf = (payment: PortalPayment) =>
    payment.kind ? `${say(`payKind_${payment.kind}`)}${payment.kind === "rent" && payment.periodLabel && locale === "en" ? ` · ${payment.periodLabel}` : ""}` : payment.label;
  const dueOf = (payment: PortalPayment) => (payment.atHandover ? say("dueAtHandover") : payment.overdue ? say("wasDue", { date: customerDate(payment.dueDate, locale, false) }) : say("dueOn", { date: customerDate(payment.dueDate, locale, false) }));
  const choices: Choice[] = [
    ...(bundle ? [{ paymentId: bundle.ids[0], covers: bundle.ids, amount: bundle.amount, name: say("allPaymentsTogether", { count: bundle.ids.length }), due: say("oneTransferOneReceipt") }] : []),
    ...payments.map((payment) => ({ paymentId: payment.id, covers: [], amount: payment.amount, name: nameOf(payment), due: dueOf(payment) }))
  ];
  const matched: Choice | null = match
    ? match.covers.length > 1
      ? { paymentId: match.paymentId, covers: match.covers, amount: match.amount, name: payments.filter((payment) => match.covers.includes(payment.id)).map(nameOf).join(" + "), due: say("oneTransferOneReceipt") }
      : choices.find((choice) => choice.paymentId === match.paymentId && !choice.covers.length) || null
    : null;

  async function pick(chosen: File) {
    setError(null);
    setNotSlip(false);
    setDuplicate(false);
    setMatch(null);
    setRead(null);
    setStage("reading");
    const small = await shrink(chosen);
    setFile(small);
    try {
      const form = new FormData();
      form.set("token", token);
      form.set("slip", small);
      const result = await readPaymentSlip(form);
      if (!result.ok) {
        setError(result.error);
        setStage("idle");
        return;
      }
      setRead(result.read);
      setDuplicate(Boolean(result.duplicate));
      setNotSlip(Boolean((result as { notSlip?: boolean }).notSlip));
      setMatch(result.match);
      setStage(result.match ? "ask" : "pick");
    } catch {
      // Couldn't read it: the customer still only has to say which payment it is for.
      setStage("pick");
    }
  }

  async function send(choice: Choice) {
    if (!file) return;
    setError(null);
    setStage("sending");
    try {
      const form = new FormData();
      form.set("token", token);
      form.set("receipt", file);
      form.set("paymentId", choice.paymentId);
      if (choice.covers.length) form.set("covers", choice.covers.join(","));
      form.set("method", defaultMethod);
      if (read) form.set("slipRead", JSON.stringify(read));
      const result = await submitPaymentReceipt(form);
      if (!result.success) {
        setError(result.error || say("receiptFailed"));
        setStage(match ? "ask" : "pick");
        return;
      }
      setStage("sent");
      router.refresh();
    } catch {
      setError(say("receiptFailed"));
      setStage(match ? "ask" : "pick");
    }
  }

  const readLine = read?.amount
    ? read.date
      ? say("slipShowsOn", { amount: money(read.amount, currency), date: customerDate(read.date, locale, false) })
      : say("slipShows", { amount: money(read.amount, currency) })
    : null;

  return (
    <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-secondary)] p-4">
      <input
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = "";
          if (chosen) void pick(chosen);
        }}
        ref={input}
        type="file"
      />

      {stage === "idle" || stage === "reading" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--primary)]">
            {stage === "reading" ? <Loader2 className="animate-spin" size={20} /> : <Receipt size={20} />}
          </span>
          <div className="min-w-[10rem] flex-1">
            <p className="text-base font-semibold text-[var(--foreground)]">{stage === "reading" ? say("slipReading") : say("slipTitle")}</p>
            <p className="text-sm text-[var(--muted)]">{stage === "reading" ? say("slipReadingHint") : say("slipHint")}</p>
          </div>
          <button className="pressable min-h-11 w-full rounded-full bg-[var(--primary)] px-5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto" disabled={stage === "reading"} onClick={() => input.current?.click()} type="button">
            {say("slipSend")}
          </button>
        </div>
      ) : null}

      {stage === "ask" && matched ? (
        <div>
          {readLine ? <p className="text-sm font-semibold text-[var(--muted)]">{readLine}</p> : null}
          <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">{say("slipIsItFor", { name: matched.name })}</p>
          <p className="text-sm text-[var(--muted)]">
            {money(matched.amount, currency)} · {matched.due}
          </p>
          {duplicate ? <p className="mt-2 rounded-xl bg-[var(--warning-light)] p-3 text-sm font-semibold text-[var(--warning)]">{say("slipSentBefore")}</p> : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button className="pressable min-h-12 rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-white" onClick={() => void send(matched)} type="button">
              {say("slipYes")}
            </button>
            <button className="pressable min-h-12 rounded-full border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--foreground)]" onClick={() => setStage("pick")} type="button">
              {say("slipNo")}
            </button>
          </div>
        </div>
      ) : null}

      {stage === "pick" ? (
        <div>
          {readLine ? <p className="text-sm font-semibold text-[var(--muted)]">{readLine}</p> : null}
          {notSlip ? <p className="text-sm font-semibold text-[var(--warning)]">{say("slipNotSlip")}</p> : null}
          <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">{say("slipWhichOne")}</p>
          {duplicate ? <p className="mt-2 rounded-xl bg-[var(--warning-light)] p-3 text-sm font-semibold text-[var(--warning)]">{say("slipSentBefore")}</p> : null}
          <div className="mt-3 space-y-2">
            {choices.map((choice) => (
              <button
                className="pressable flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white p-3 text-left"
                key={`${choice.paymentId}-${choice.covers.length}`}
                onClick={() => void send(choice)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-[var(--foreground)]">{choice.name}</span>
                  <span className="block text-sm text-[var(--muted)]">{choice.due}</span>
                </span>
                <span className="shrink-0 font-semibold text-[var(--foreground)]">{money(choice.amount, currency)}</span>
              </button>
            ))}
          </div>
          <button className="mt-3 text-sm font-semibold text-[var(--primary)]" onClick={() => input.current?.click()} type="button">
            {say("slipAnother")}
          </button>
        </div>
      ) : null}

      {stage === "sending" ? (
        <p className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
          <Loader2 className="animate-spin" size={18} />
          {say("sending")}
        </p>
      ) : null}

      {stage === "sent" ? (
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-[var(--success)]" size={22} />
          <div>
            <p className="text-base font-semibold text-[var(--foreground)]">{say("slipSent")}</p>
            <p className="text-sm text-[var(--muted)]">{say("receiptSentWaiting", { business: organizationName })}</p>
            <button className="mt-2 text-sm font-semibold text-[var(--primary)]" onClick={() => { setStage("idle"); setFile(null); }} type="button">
              {say("slipAnotherPayment")}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
