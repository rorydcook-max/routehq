"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Banknote, Building2, CheckCircle2, Globe2, QrCode, X } from "lucide-react";
import { MoneyInput } from "@/components/money-input";
import { promptPayPayload } from "@/lib/promptpay";

/** The business's ways of being paid (Settings › How customers pay you), as the handover needs them. */
export type HandoverPayOptions = {
  accepted: string[];
  defaultMethod: string | null;
  promptpayId: string | null;
  promptpayQrUrl: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  wiseLink: string | null;
  revolutLink: string | null;
  /** The customer's booking page path ("/book/abc"), where they can pay and send a slip. */
  portalPath: string | null;
  portalUrl: string | null;
};

export type HandoverPayResult = { receipt_number: string; pdf_url: string; warning?: string };

type Method = "cash" | "promptpay" | "bank_transfer" | "wise" | "revolut";

const round2 = (value: number) => Math.round(value * 100) / 100;

/** The methods this business takes and has the details for (the same rule as the customer's booking page). */
export function handoverMethods(pay: HandoverPayOptions): Method[] {
  const accepted = Array.isArray(pay.accepted) && pay.accepted.length ? pay.accepted : ["cash"];
  const list = Array.from(new Set(["cash", ...accepted])).filter((method): method is Method => {
    if (method === "cash") return true;
    if (method === "promptpay") return Boolean(pay.promptpayId || pay.promptpayQrUrl);
    if (method === "bank_transfer") return Boolean(pay.bankAccountNumber);
    if (method === "wise") return Boolean(pay.wiseLink);
    if (method === "revolut") return Boolean(pay.revolutLink);
    // TODO(card): card payments (Stripe Connect) are not live yet. When they are, add "card" here with a
    // payment link / Terminal hook and show its QR in PayScreen, then record through the same action.
    return false;
  });
  return list;
}

export function HandoverPaymentStep({
  currency,
  rentDue,
  depositDue,
  pay,
  money,
  onRecord,
  onLeftChange
}: {
  currency: string;
  rentDue: number;
  depositDue: number;
  pay: HandoverPayOptions;
  money: (value: number) => string;
  /** Records money taken now through the handover's payment action. */
  onRecord: (method: Method, rent: number, deposit: number) => Promise<HandoverPayResult>;
  /** What is still unpaid, each time it changes. */
  onLeftChange?: (left: number) => void;
}) {
  const t = useTranslations("handoverPay");
  const methods = useMemo(() => handoverMethods(pay), [pay]);
  const [paidRent, setPaidRent] = useState(0);
  const [paidDeposit, setPaidDeposit] = useState(0);
  const [method, setMethod] = useState<Method | null>(() => (methods.length === 1 ? methods[0] : methods.includes(pay.defaultMethod as Method) ? (pay.defaultMethod as Method) : null));
  const [cashAnswer, setCashAnswer] = useState<"yes" | "part" | "no" | null>(null);
  const [partAmount, setPartAmount] = useState("");
  const [screenOpen, setScreenOpen] = useState(false);
  const [receipts, setReceipts] = useState<HandoverPayResult[]>([]);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  // Which button is saving, so only that one says "Saving...".
  const [savingFrom, setSavingFrom] = useState<"yes" | "part" | "screen">("screen");

  const rentLeft = round2(Math.max(0, rentDue - paidRent));
  const depositLeft = round2(Math.max(0, depositDue - paidDeposit));
  const left = round2(rentLeft + depositLeft);
  const total = round2(rentDue + depositDue);

  useEffect(() => {
    onLeftChange?.(left);
  }, [left, onLeftChange]);

  function record(chosen: Method, amount: number, after?: () => void, from: "yes" | "part" | "screen" = "screen") {
    const take = round2(Math.min(amount, left));
    if (!(take > 0)) return;
    // Rent first, then the deposit (held, not income).
    const rent = round2(Math.min(take, rentLeft));
    const deposit = round2(Math.min(take - rent, depositLeft));
    setError("");
    setSavingFrom(from);
    startTransition(async () => {
      try {
        const result = await onRecord(chosen, rent, deposit);
        setPaidRent((value) => round2(value + rent));
        setPaidDeposit((value) => round2(value + deposit));
        setReceipts((list) => [...list, result]);
        setCashAnswer(null);
        setPartAmount("");
        after?.();
      } catch {
        setError(t("failed"));
      }
    });
  }

  const methodName = (key: Method) => t(`m_${key}`);
  const icon = (key: Method) => (key === "cash" ? Banknote : key === "promptpay" ? QrCode : key === "bank_transfer" ? Building2 : Globe2);

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-2xl bg-[var(--panel-secondary)] p-4">
        {rentDue > 0 ? <Line label={t("rent")} value={money(rentDue)} /> : null}
        {depositDue > 0 ? <Line label={t("deposit")} value={money(depositDue)} /> : null}
        <div className="flex items-baseline justify-between gap-3 border-t border-[var(--border)] pt-2">
          <span className="text-base font-bold text-[var(--foreground)]">{t("total")}</span>
          <span className="font-mono-data text-2xl font-bold text-[var(--foreground)]">{money(total)}</span>
        </div>
        {paidRent + paidDeposit > 0 ? (
          <>
            <Line label={t("paid")} tone="success" value={money(round2(paidRent + paidDeposit))} />
            {left > 0 ? <Line label={t("left")} tone="danger" value={money(left)} /> : null}
          </>
        ) : null}
      </div>

      {left <= 0 ? (
        <p className="flex items-center gap-2 rounded-2xl bg-[var(--success-light)] p-4 text-lg font-bold text-[var(--success)]">
          <CheckCircle2 size={24} />
          {t("paidInFull")}
        </p>
      ) : (
        <>
          <div>
            <p className="mb-2 text-base font-semibold text-[var(--foreground)]">{t("howPay")}</p>
            <div className="grid grid-cols-2 gap-2">
              {methods.map((key) => {
                const Icon = icon(key);
                const on = method === key;
                return (
                  <button
                    aria-pressed={on}
                    className={`pressable flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 text-center text-base font-semibold ${on ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground)]"}`}
                    key={key}
                    onClick={() => {
                      setMethod(key);
                      setCashAnswer(null);
                      setError("");
                    }}
                    type="button"
                  >
                    <Icon className="shrink-0" size={22} />
                    <span className="max-w-full truncate">{methodName(key)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {method === "cash" ? (
            <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
              <p className="text-lg font-semibold text-[var(--foreground)]">{t("cashAsk", { amount: money(left) })}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["yes", "part", "no"] as const).map((answer) => (
                  <button
                    aria-pressed={cashAnswer === answer}
                    className={`pressable min-h-14 rounded-2xl border-2 text-base font-bold disabled:opacity-50 ${cashAnswer === answer ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--foreground)]"}`}
                    disabled={isPending}
                    key={answer}
                    onClick={() => {
                      setCashAnswer(answer);
                      setError("");
                      if (answer === "yes") record("cash", left, undefined, "yes");
                    }}
                    type="button"
                  >
                    {answer === "yes" && isPending && savingFrom === "yes" ? t("saving") : t(answer)}
                  </button>
                ))}
              </div>
              {cashAnswer === "part" ? (
                <div className="mt-3 flex items-end gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("amountPaid")}</span>
                    <MoneyInput currency={currency} name="handoverPartAmount" onValueChange={setPartAmount} />
                  </label>
                  <button
                    className="pressable min-h-12 shrink-0 whitespace-nowrap rounded-full bg-[var(--primary)] px-5 text-base font-semibold text-white disabled:opacity-40"
                    disabled={isPending || !(Number(partAmount) > 0)}
                    onClick={() => record("cash", Number(partAmount), undefined, "part")}
                    type="button"
                  >
                    {isPending && savingFrom === "part" ? t("saving") : t("record")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : method ? (
            <button
              className="pressable flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 text-base font-semibold text-white"
              onClick={() => setScreenOpen(true)}
              type="button"
            >
              <QrCode size={20} />
              {t("showCustomer")}
            </button>
          ) : null}
        </>
      )}

      {error ? <p className="rounded-xl bg-[var(--danger-light)] px-3 py-2 text-sm font-bold text-[var(--danger)]" role="alert">{error}</p> : null}

      {receipts.filter((receipt) => receipt.pdf_url).length ? (
        <div className="flex flex-wrap gap-2">
          {receipts.filter((receipt) => receipt.pdf_url).map((receipt) => (
            <a className="pressable inline-flex min-h-11 items-center rounded-full border border-[var(--success-line)] bg-white px-4 text-sm font-semibold text-[var(--success)]" href={receipt.pdf_url} key={receipt.receipt_number} rel="noreferrer" target="_blank">
              {t("receipt", { number: receipt.receipt_number })}
            </a>
          ))}
        </div>
      ) : null}

      {screenOpen && method && method !== "cash" ? (
        <PayScreen
          amount={left}
          busy={isPending}
          currency={currency}
          method={method}
          methodName={methodName(method)}
          money={money}
          onClose={() => setScreenOpen(false)}
          onPaid={() => record(method, left, () => setScreenOpen(false))}
          pay={pay}
        />
      ) : null}
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  const colour = tone === "success" ? "text-[var(--success)]" : tone === "danger" ? "text-[var(--danger)]" : "text-[var(--foreground)]";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-base font-semibold ${tone ? colour : "text-[var(--foreground-secondary)]"}`}>{label}</span>
      <span className={`font-mono-data text-lg font-semibold ${colour}`}>{value}</span>
    </div>
  );
}

/** Full screen on the operator's phone, turned to the customer: the code to scan, the amount, and the details. */
function PayScreen({
  method,
  methodName,
  amount,
  currency,
  money,
  pay,
  busy,
  onPaid,
  onClose
}: {
  method: Exclude<Method, "cash">;
  methodName: string;
  amount: number;
  currency: string;
  money: (value: number) => string;
  pay: HandoverPayOptions;
  busy: boolean;
  onPaid: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("handoverPay");
  const [svg, setSvg] = useState<string | null>(null);
  const portal = pay.portalUrl || (pay.portalPath && typeof window !== "undefined" ? `${window.location.origin}${pay.portalPath}` : null);
  // PromptPay carries the exact amount; Wise and Revolut open the business's own link; a bank transfer opens
  // the customer's booking page, where the details are and a slip can be sent (and matched).
  const promptPayText = method === "promptpay" && pay.promptpayId && currency === "THB" ? promptPayPayload(pay.promptpayId, amount) : null;
  const qrText = method === "promptpay" ? promptPayText : method === "wise" ? pay.wiseLink : method === "revolut" ? pay.revolutLink : portal;
  const staticQr = method === "promptpay" && !promptPayText ? pay.promptpayQrUrl : null;

  useEffect(() => {
    let live = true;
    if (!qrText) {
      setSvg(null);
      return;
    }
    QRCode.toString(qrText, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then((value) => live && setSvg(value))
      .catch(() => live && setSvg(null));
    return () => {
      live = false;
    };
  }, [qrText]);

  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  return (
    <div aria-modal="true" className="fixed inset-0 z-[80] flex flex-col bg-white" role="dialog">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <p className="text-lg font-bold text-[var(--foreground)]">{methodName}</p>
        <button aria-label={t("close")} className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-[var(--panel-secondary)] text-[var(--foreground)]" onClick={onClose} type="button">
          <X size={22} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-4 py-2 text-center">
        <p className="font-mono-data text-4xl font-bold text-[var(--foreground)] sm:text-5xl">{money(amount)}</p>
        {svg ? (
          <div aria-label={methodName} className="w-[min(82vw,52vh,400px)] rounded-2xl border border-[var(--border)] bg-white p-3 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} role="img" />
        ) : staticQr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={methodName} className="w-[min(82vw,52vh,400px)] rounded-2xl border border-[var(--border)] bg-white p-3" src={staticQr} />
        ) : null}
        <div className="w-full max-w-sm space-y-1.5">
          {method === "promptpay" && pay.promptpayId ? <Detail label={t("promptpayId")} value={pay.promptpayId} /> : null}
          {method === "bank_transfer" ? (
            <>
              {pay.bankName ? <Detail label={t("bank")} value={pay.bankName} /> : null}
              {pay.bankAccountNumber ? <Detail label={t("account")} value={pay.bankAccountNumber} /> : null}
              {pay.bankAccountName ? <Detail label={t("accountName")} value={pay.bankAccountName} /> : null}
            </>
          ) : null}
          {(method === "wise" || method === "revolut") && qrText ? <p className="break-all text-sm font-medium text-[var(--foreground-secondary)]">{qrText}</p> : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        <button className="pressable min-h-14 rounded-full border border-[var(--border)] bg-white text-base font-semibold text-[var(--foreground-secondary)]" onClick={onClose} type="button">
          {t("notYet")}
        </button>
        <button className="pressable min-h-14 rounded-full bg-[var(--primary)] text-base font-bold text-white disabled:opacity-50" disabled={busy} onClick={onPaid} type="button">
          {busy ? t("saving") : t("markPaid")}
        </button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--panel-secondary)] px-3 py-2.5 text-left">
      <span className="text-sm font-semibold text-[var(--muted)]">{label}</span>
      <span className="font-mono-data break-all text-base font-semibold text-[var(--foreground)]">{value}</span>
    </div>
  );
}
