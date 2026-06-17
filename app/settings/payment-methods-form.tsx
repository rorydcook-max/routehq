"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { updatePaymentSettings } from "@/app/actions/settings";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(18,184,200,0.16)]";

type PaymentSettings = {
  accepted_payment_methods?: string[] | null;
  promptpay_id?: string | null;
  promptpay_qr_url?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
  wise_link?: string | null;
  revolut_link?: string | null;
  receipt_prefix?: string | null;
  receipt_footer_text?: string | null;
  default_payment_method?: string | null;
};

const methodLabels: Record<string, string> = {
  cash: "Cash",
  promptpay: "PromptPay / QR Payment",
  bank_transfer: "Thai Bank Transfer",
  wise: "Wise",
  revolut: "Revolut"
};

function normaliseMethods(methods: unknown) {
  if (!Array.isArray(methods)) {
    return ["cash"];
  }

  const valid = methods.filter((method): method is string => typeof method === "string" && method in methodLabels);
  return Array.from(new Set(["cash", ...valid]));
}

export function PaymentMethodsForm({
  businessName,
  settings
}: {
  businessName: string;
  settings: PaymentSettings;
}) {
  const initialMethods = useMemo(() => normaliseMethods(settings.accepted_payment_methods), [settings.accepted_payment_methods]);
  const [enabledMethods, setEnabledMethods] = useState<string[]>(initialMethods);
  const [receiptPrefix, setReceiptPrefix] = useState(settings.receipt_prefix || "REC");
  const [promptPayQrUrl, setPromptPayQrUrl] = useState(settings.promptpay_qr_url || "");
  const [removePromptPayQr, setRemovePromptPayQr] = useState(false);
  const [defaultMethod, setDefaultMethod] = useState(
    initialMethods.includes(settings.default_payment_method || "") ? settings.default_payment_method || "cash" : "cash"
  );
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableDefaultMethods = enabledMethods.filter((method) => method in methodLabels);
  const acceptedMethodsJson = JSON.stringify(enabledMethods);
  const previewPrefix = receiptPrefix.trim().slice(0, 6) || "REC";

  function toggleMethod(method: string, checked: boolean) {
    setEnabledMethods((current) => {
      const next = checked ? Array.from(new Set([...current, method])) : current.filter((item) => item !== method);
      const safeNext = Array.from(new Set(["cash", ...next]));

      if (!safeNext.includes(defaultMethod)) {
        setDefaultMethod("cash");
      }

      return safeNext;
    });
  }

  function submitPaymentSettings(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await updatePaymentSettings(formData);
        setMessage({ tone: "success", text: "Payment settings saved." });
      } catch (error) {
        setMessage({
          tone: "error",
          text: error instanceof Error ? error.message : "Unable to save payment settings."
        });
      }
    });
  }

  return (
    <form action={submitPaymentSettings} className="mt-3 space-y-3">
      <input name="accepted_payment_methods" type="hidden" value={acceptedMethodsJson} />
      <input name="promptpay_qr_remove" type="hidden" value={removePromptPayQr ? "true" : "false"} />

      <section className="form-section bg-[var(--primary-light)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0f766e]">Accepted methods</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <MethodCard
            checked
            description="Paid in person on delivery or collection"
            disabled
            label="Cash"
            name="cash"
          />
          <MethodCard
            checked={enabledMethods.includes("promptpay")}
            description="Thai QR payment - customers scan with their banking app"
            label="PromptPay / QR Payment"
            name="promptpay"
            onToggle={toggleMethod}
          >
            <div className="mt-3 grid gap-3">
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">PromptPay ID</span>
                <input className={inputClass} defaultValue={settings.promptpay_id || ""} name="promptpay_id" placeholder="Phone number (e.g. 0812345678) or national ID" />
                <span className="mt-1 block text-xs leading-5 text-[#667085]">
                  Displayed as text below your QR code so customers can also pay by searching your number manually.
                </span>
              </label>

              <div className="rounded-lg border border-[var(--border)] bg-[#f8fafc] p-3">
                <p className="text-[11px] font-medium text-[var(--foreground-secondary)]">PromptPay QR Code</p>
                <p className="mt-1 text-xs leading-5 text-[#667085]">
                  Upload a screenshot or photo of your PromptPay QR code. Customers will scan this in their Thai banking app to pay. You can find your QR code in your banking app under 'Receive money' or 'My QR code'.
                </p>
                {promptPayQrUrl && !removePromptPayQr ? (
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <img alt="PromptPay QR code preview" className="h-28 w-28 rounded-lg border border-[var(--border)] bg-white object-contain p-1" src={promptPayQrUrl} />
                    <div className="flex flex-wrap gap-2">
                      <label className="pressable inline-flex cursor-pointer rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-black text-[#344054]">
                        Replace
                        <input accept="image/png,image/jpeg,image/webp" className="sr-only" name="promptpay_qr" type="file" />
                      </label>
                      <button
                        className="pressable rounded-lg border border-[#fecdd3] bg-[#fff1f2] px-3 py-2 text-sm font-black text-[#be123c]"
                        onClick={() => {
                          setRemovePromptPayQr(true);
                          setPromptPayQrUrl("");
                        }}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="mt-3 block">
                    <input accept="image/png,image/jpeg,image/webp" className={inputClass} name="promptpay_qr" type="file" />
                  </label>
                )}
              </div>
            </div>
          </MethodCard>
          <MethodCard
            checked={enabledMethods.includes("bank_transfer")}
            description="Direct transfer to your Thai bank account"
            label="Thai Bank Transfer"
            name="bank_transfer"
            onToggle={toggleMethod}
          >
            <div className="mt-3 grid gap-3">
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Bank name</span>
                <input className={inputClass} defaultValue={settings.bank_name || ""} name="bank_name" placeholder="e.g. Kasikorn, SCB, Bangkok Bank" />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Account number</span>
                <input className={inputClass} defaultValue={settings.bank_account_number || ""} name="bank_account_number" />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Account name</span>
                <input className={inputClass} defaultValue={settings.bank_account_name || ""} name="bank_account_name" />
              </label>
            </div>
          </MethodCard>
          <MethodCard
            checked={enabledMethods.includes("wise")}
            description="For international customers without a Thai bank account"
            label="Wise"
            name="wise"
            onToggle={toggleMethod}
          >
            <label className="mt-3 block">
              <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Wise.me link or email</span>
              <input className={inputClass} defaultValue={settings.wise_link || ""} name="wise_link" placeholder="e.g. wise.com/pay/me/yourname" />
            </label>
          </MethodCard>
          <MethodCard
            checked={enabledMethods.includes("revolut")}
            description="For European customers"
            label="Revolut"
            name="revolut"
            onToggle={toggleMethod}
          >
            <label className="mt-3 block">
              <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Revolut.me link</span>
              <input className={inputClass} defaultValue={settings.revolut_link || ""} name="revolut_link" placeholder="e.g. revolut.me/yourname" />
            </label>
          </MethodCard>
          <div className="rounded-lg border border-[var(--border)] bg-[#f8fafc] p-3 opacity-75">
            <div className="flex items-start justify-between gap-3">
              <label className="checkbox-label">
                <input className="flex-shrink-0" disabled type="checkbox" />
                <span>
                  <span className="block font-black text-[#64748b]">Credit / Debit Card</span>
                  <span className="mt-1 block text-xs leading-5 text-[#667085]">Card payments via Stripe</span>
                </span>
              </label>
              <span className="rounded-full border border-[#fde68a] bg-[#fffbeb] px-2 py-1 text-xs font-bold uppercase text-[#d97706]">
                Coming soon
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="form-section bg-[var(--warning-light)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0f766e]">Receipt settings</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Receipt number prefix</span>
            <input
              className={inputClass}
              maxLength={6}
              name="receipt_prefix"
              onChange={(event) => setReceiptPrefix(event.target.value)}
              value={receiptPrefix}
            />
            <span className="mt-1 block text-xs text-[#667085]">Next receipt will be: {previewPrefix}-2026-0001</span>
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Default payment method</span>
            <select className={inputClass} name="default_payment_method" onChange={(event) => setDefaultMethod(event.target.value)} value={defaultMethod}>
              {availableDefaultMethods.map((method) => (
                <option key={method} value={method}>
                  {methodLabels[method]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block">
          <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Receipt footer text</span>
          <textarea
            className={`${inputClass} min-h-28`}
            defaultValue={settings.receipt_footer_text || ""}
            name="receipt_footer_text"
            placeholder={`e.g. Thank you for choosing ${businessName}! Drive safe.`}
          />
        </label>
      </section>

      {message ? (
        <p
          className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
            message.tone === "success"
              ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
              : "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <button className="primary-action w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={isPending} type="submit">
        {isPending ? "Saving..." : "Save payment settings"}
      </button>
    </form>
  );
}

function MethodCard({
  checked,
  children,
  description,
  disabled,
  label,
  name,
  onToggle
}: {
  checked: boolean;
  children?: ReactNode;
  description: string;
  disabled?: boolean;
  label: string;
  name: string;
  onToggle?: (name: string, checked: boolean) => void;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        checked ? "border-[var(--primary)] bg-white shadow-[0_12px_26px_rgba(18,184,200,0.12)]" : "border-[var(--border)] bg-white"
      }`}
    >
      <label className="checkbox-label">
        <input
          checked={checked}
          className="flex-shrink-0"
          disabled={disabled}
          onChange={(event) => onToggle?.(name, event.target.checked)}
          type="checkbox"
        />
        <span>
          <span className="block font-black text-[#10252b]">{label}</span>
          <span className="mt-1 block text-xs leading-5 text-[#667085]">{description}</span>
        </span>
      </label>
      {checked ? children : null}
    </div>
  );
}
