"use client";

import { customerDate } from "@/lib/i18n/customer-dates";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Clock, Copy, Wallet } from "lucide-react";
import { submitPaymentReceipt } from "@/app/actions/public-booking";
import type { PortalBundle, PortalPayment } from "@/lib/payment-receipts";

type OrgPayment = {
  promptpay_id?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
  wise_link?: string | null;
  revolut_link?: string | null;
} | null;

function shortDate(iso: string, locale: string) {
  return customerDate(iso, locale, false);
}

function money(amount: number, currency: string) {
  const value = amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return currency === "THB" ? `฿${value}` : `${currency} ${value}`;
}

/** Phone photos are several MB; a receipt reads fine at 1600px. PDFs and small files go as they are. */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 600_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? new File([blob], "receipt.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function PortalPayments({
  token,
  payments,
  bundle = null,
  orgPayment,
  organizationName
}: {
  token: string;
  payments: PortalPayment[];
  bundle?: PortalBundle | null;
  orgPayment: OrgPayment;
  organizationName: string;
}) {
  const t = useTranslations("customer");
  const [openId, setOpenId] = useState<string | null>(null);
  if (payments.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase text-[var(--primary)]">{t("payments")}</p>
      <div className="mt-3 divide-y divide-[var(--border)]">
        {bundle ? (
          <PaymentRow
            covers={bundle.ids}
            isOpen={openId === "all"}
            key={`all-${bundle.ids.join("-")}`}
            onToggle={() => setOpenId(openId === "all" ? null : "all")}
            orgPayment={orgPayment}
            organizationName={organizationName}
            payment={{
              id: bundle.ids[0],
              label: t("allPaymentsTogether", { count: bundle.ids.length }),
              amount: bundle.amount,
              currency: bundle.currency,
              dueDate: "",
              overdue: false,
              qrSvg: bundle.qrSvg,
              receiptSentAt: null,
              receiptDeclined: false
            }}
            token={token}
          />
        ) : null}
        {payments.map((payment) => (
          <PaymentRow
            isOpen={openId === payment.id}
            key={payment.id}
            onToggle={() => setOpenId(openId === payment.id ? null : payment.id)}
            orgPayment={orgPayment}
            organizationName={organizationName}
            payment={payment}
            token={token}
          />
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{t("payingInCash", { business: organizationName })}</p>
    </section>
  );
}

function PaymentRow({
  token,
  payment,
  orgPayment,
  organizationName,
  isOpen,
  onToggle,
  covers
}: {
  token: string;
  payment: PortalPayment;
  orgPayment: OrgPayment;
  organizationName: string;
  isOpen: boolean;
  onToggle: () => void;
  /** Set on the "everything together" row: the payments one receipt will cover. */
  covers?: string[];
}) {
  const t = useTranslations("customer");
  const locale = useLocale();
  const router = useRouter();
  // The page reloads its data after a receipt is sent (possibly from another row).
  const [justSentAt, setSentAt] = useState<string | null>(null);
  const sentAt = payment.receiptSentAt || (covers ? null : justSentAt);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasBank = !!orgPayment?.bank_account_number;
  const defaultMethod = payment.qrSvg ? "promptpay" : hasBank ? "bank_transfer" : orgPayment?.wise_link ? "wise" : orgPayment?.revolut_link ? "revolut" : "other";

  function send(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const file = formData.get("receipt");
        if (!(file instanceof File) || file.size === 0) {
          setError(t("addReceiptPhoto"));
          return;
        }
        formData.set("receipt", await shrinkImage(file));
        formData.set("token", token);
        formData.set("paymentId", payment.id);
        if (covers?.length) formData.set("covers", covers.join(","));
        const result = await submitPaymentReceipt(formData);
        if (!result.success) {
          setError(result.error || t("receiptFailed"));
          return;
        }
        setSentAt(result.submittedAt || new Date().toISOString());
        onToggle();
        router.refresh();
      } catch {
        setError(t("receiptFailed"));
      }
    });
  }

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${sentAt ? "bg-[var(--success-light)] text-[var(--success)]" : payment.overdue ? "bg-[var(--danger-light)] text-[var(--danger)]" : "bg-[var(--primary-light)] text-[var(--primary)]"}`}>
          {sentAt ? <Clock size={20} /> : <Wallet size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-[var(--foreground)]">
            {money(payment.amount, payment.currency)}{" "}
            <span className="text-sm font-medium text-[var(--muted)]">
              · {payment.kind ? `${t(`payKind_${payment.kind}`)}${payment.kind === "rent" && payment.periodLabel && locale === "en" ? ` · ${payment.periodLabel}` : ""}` : payment.label}
            </span>
          </p>
          <p className={`text-sm ${sentAt ? "text-[var(--success)]" : payment.overdue ? "font-semibold text-[var(--danger)]" : "text-[var(--muted)]"}`}>
            {sentAt
              ? t("receiptSentWaiting", { business: organizationName })
              : covers
                ? t("oneTransferOneReceipt")
                : payment.overdue
                  ? t("wasDue", { date: shortDate(payment.dueDate, locale) })
                  : t("dueOn", { date: shortDate(payment.dueDate, locale) })}
          </p>
        </div>
        <button
          className={`pressable min-h-10 shrink-0 rounded-xl px-4 text-sm font-semibold ${sentAt || isOpen ? "border border-[var(--border)] bg-white text-[var(--foreground)]" : "bg-[var(--primary)] text-white"}`}
          onClick={onToggle}
          type="button"
        >
          {isOpen ? t("close") : sentAt ? t("change") : t("pay")}
        </button>
      </div>

      {payment.receiptDeclined && !sentAt ? (
        <p className="mt-2 rounded-xl bg-[var(--warning-light)] p-3 text-sm text-[var(--warning)]">
          {t("receiptDeclined", { business: organizationName })}
        </p>
      ) : null}

      {isOpen ? (
        <div className="mt-4 space-y-4">
          {payment.qrSvg ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-secondary)] p-4 text-center">
              <p className="text-sm font-semibold text-[var(--foreground)]">{t("scanWithBankingApp")}</p>
              <div aria-label="PromptPay QR code" className="mx-auto mt-3 w-52 max-w-full rounded-xl bg-white p-2 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: payment.qrSvg }} role="img" />
              <p className="mt-3 text-sm text-[var(--foreground-secondary)]">
                {t.rich("promptPayFilledIn", { amount: money(payment.amount, payment.currency), b: (chunks) => <span className="font-semibold text-[var(--foreground)]">{chunks}</span> })}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">{t("onThisPhone")}</p>
            </div>
          ) : null}

          {hasBank || orgPayment?.wise_link || orgPayment?.revolut_link || (!payment.qrSvg && orgPayment?.promptpay_id) ? (
            <div className="space-y-2">
              {payment.qrSvg ? <p className="text-xs font-semibold uppercase text-[var(--muted)]">{t("orPayAnotherWay")}</p> : null}
              {!payment.qrSvg && orgPayment?.promptpay_id ? <CopyLine label="PromptPay" value={String(orgPayment.promptpay_id)} /> : null}
              {hasBank ? (
                <CopyLine
                  detail={[orgPayment?.bank_name, orgPayment?.bank_account_name].filter(Boolean).join(" · ")}
                  label={t("bankTransfer")}
                  value={String(orgPayment?.bank_account_number)}
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                {orgPayment?.wise_link ? (
                  <a className="pressable inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--foreground)]" href={orgPayment.wise_link} rel="noreferrer" target="_blank">
                    {t("payWith", { app: "Wise" })}
                  </a>
                ) : null}
                {orgPayment?.revolut_link ? (
                  <a className="pressable inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--foreground)]" href={orgPayment.revolut_link} rel="noreferrer" target="_blank">
                    {t("payWith", { app: "Revolut" })}
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          {!payment.qrSvg && !hasBank && !orgPayment?.promptpay_id && !orgPayment?.wise_link && !orgPayment?.revolut_link ? (
            <p className="rounded-xl bg-[var(--panel-secondary)] p-3 text-sm text-[var(--foreground-secondary)]">
              {t("askWhereToPay", { business: organizationName })}
            </p>
          ) : null}

          <form action={send} className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">{t("paidSendReceipt")}</p>
            <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
              {t("receiptPhoto")}
              <input accept="image/*,application/pdf" className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm" name="receipt" required type="file" />
            </label>
            <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
              {t("howDidYouPay")}
              <select className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-base" defaultValue={defaultMethod} name="method">
                <option value="promptpay">PromptPay / QR</option>
                <option value="bank_transfer">{t("bankTransfer")}</option>
                <option value="wise">Wise</option>
                <option value="revolut">Revolut</option>
                <option value="other">{t("anotherWay")}</option>
              </select>
            </label>
            {error ? <p className="text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
            <button className="pressable min-h-12 w-full rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
              {isPending ? t("sending") : t("sendReceipt")}
            </button>
            <p className="flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
              <CheckCircle2 className="mt-0.5 shrink-0 text-[var(--primary)]" size={14} />
              {t("willCheckReceipt", { business: organizationName })}
            </p>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function CopyLine({ label, value, detail }: { label: string; value: string; detail?: string }) {
  const t = useTranslations("customer");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white p-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
        <p className="font-mono-data break-all text-base font-semibold text-[var(--foreground)]">{value}</p>
        {detail ? <p className="text-sm text-[var(--muted)]">{detail}</p> : null}
      </div>
      <button
        className="pressable inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-[var(--primary)]"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }).catch(() => null);
        }}
        type="button"
      >
        <Copy size={15} />
        {copied ? t("copied") : t("copy")}
      </button>
    </div>
  );
}
