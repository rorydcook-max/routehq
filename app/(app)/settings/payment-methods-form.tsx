"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { FormEvent, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { updatePaymentSettings as updatePaymentSettingsAction } from "@/app/actions/settings";
import { SwitchField } from "@/components/switch-field";
import { InfoTip } from "@/components/info-tip";
import { unwrap } from "@/lib/action-result";
import { shownError } from "@/lib/error-text";
import { isThaiQrPayload } from "@/lib/promptpay";

// A save that fails hands back its reason (lib/action-error.ts); these throw it, for the catch blocks below to show.
const updatePaymentSettings = (...args: Parameters<typeof updatePaymentSettingsAction>) => unwrap(updatePaymentSettingsAction(...args));

type Say = (key: string, values?: Record<string, string | number>) => string;
const labelClass = "font-semibold text-[var(--foreground-secondary)]";
const helpClass = "mt-1 block font-medium text-[var(--muted)]";

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

const METHODS = ["cash", "promptpay", "bank_transfer", "wise", "revolut"];

function normaliseMethods(methods: unknown) {
  if (!Array.isArray(methods)) return ["cash"];
  const valid = methods.filter((method): method is string => typeof method === "string" && METHODS.includes(method));
  return Array.from(new Set(["cash", ...valid]));
}

export function PaymentMethodsForm({ businessName, settings, promptPay = true }: { businessName: string; settings: PaymentSettings; promptPay?: boolean }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const methodName = (method: string) => (method === "promptpay" ? say("pm_promptpayName") : method === "bank_transfer" ? say("pm_bankName") : say(`pay_${method}`));
  const initialMethods = useMemo(() => normaliseMethods(settings.accepted_payment_methods), [settings.accepted_payment_methods]);
  const [enabledMethods, setEnabledMethods] = useState<string[]>(initialMethods);
  const [receiptPrefix, setReceiptPrefix] = useState(settings.receipt_prefix || "REC");
  const [promptPayQrUrl, setPromptPayQrUrl] = useState(settings.promptpay_qr_url || "");
  const [removePromptPayQr, setRemovePromptPayQr] = useState(false);
  const [qrFileName, setQrFileName] = useState("");
  // The text inside the QR picture, read here when it is chosen: with it, customers get the QR with the amount
  // already filled in (lib/promptpay.ts). "none" = a picture was chosen but no bank QR could be read from it.
  const [qrText, setQrText] = useState("");
  async function pickQr(file: File | undefined) {
    setQrFileName(file?.name || "");
    setQrText("");
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no canvas");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const { default: jsQR } = await import("jsqr");
      const found = jsQR(pixels.data, pixels.width, pixels.height);
      setQrText(found?.data && isThaiQrPayload(found.data) ? found.data.trim() : "none");
    } catch {
      setQrText("none");
    }
  }

  // After a save the page hands back the stored picture: show it instead of the empty picker.
  useEffect(() => {
    setPromptPayQrUrl(settings.promptpay_qr_url || "");
    setRemovePromptPayQr(false);
    setQrFileName("");
    setQrText("");
  }, [settings.promptpay_qr_url]);
  const [defaultMethod, setDefaultMethod] = useState(initialMethods.includes(settings.default_payment_method || "") ? settings.default_payment_method || "cash" : "cash");
  const [result, setResult] = useState<"saved" | "failed" | null>(null);
  const [failReason, setFailReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const previewPrefix = receiptPrefix.trim().slice(0, 6) || "REC";

  function toggleMethod(method: string, checked: boolean) {
    setEnabledMethods((current) => {
      const next = checked ? Array.from(new Set([...current, method])) : current.filter((item) => item !== method);
      const safeNext = Array.from(new Set(["cash", ...next]));
      if (!safeNext.includes(defaultMethod)) setDefaultMethod("cash");
      return safeNext;
    });
  }

  // Sent by hand, not as a form action: an action clears the form afterwards, which left the ticked methods looking unticked.
  function submitPaymentSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setResult(null);
    startTransition(async () => {
      try {
        await updatePaymentSettings(formData);
        setResult("saved");
      } catch (caught) {
        // The server's reason (e.g. "PromptPay QR code must be a PNG, JPEG, or WebP image.") when it gave one.
        setFailReason(shownError(caught, ""));
        setResult("failed");
      }
    });
  }

  return (
    <form method="post" className="space-y-3" onSubmit={submitPaymentSettings}>
      <input name="accepted_payment_methods" type="hidden" value={JSON.stringify(enabledMethods)} />
      <input name="promptpay_qr_remove" type="hidden" value={removePromptPayQr ? "true" : "false"} />
      <input name="promptpay_qr_payload" type="hidden" value={qrText === "none" ? "" : qrText} />

      <div className="grid gap-2.5 md:grid-cols-2">
        <MethodCard checked disabled label={say("pay_cash")} name="cash" />
        {/* PromptPay only for businesses in Thailand (lib/payment-methods.ts). Elsewhere its saved number is sent back unchanged. */}
        {promptPay ? null : <input name="promptpay_id" type="hidden" value={settings.promptpay_id || ""} />}
        {promptPay ? (
        <MethodCard checked={enabledMethods.includes("promptpay")} label={say("pm_promptpayName")} name="promptpay" onToggle={toggleMethod}>
          <div className="mt-3 grid gap-3">
            <label className="block">
              <span className={labelClass}>
                {say("pm_ppId")} <InfoTip label={say("pm_ppId")} text={say("pm_ppIdHelp")} />
              </span>
              <input className="mt-1 w-full" defaultValue={settings.promptpay_id || ""} inputMode="numeric" name="promptpay_id" placeholder={say("pm_ppIdPh")} />
            </label>
            <div>
              <p className={labelClass}>
                {say("pm_qr")} <InfoTip label={say("pm_qr")} text={say("pm_qrHelp")} />
              </p>
              {promptPayQrUrl && !removePromptPayQr ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <img alt={say("pm_qrAlt")} className="h-28 w-28 rounded-xl bg-white object-contain p-1" src={promptPayQrUrl} />
                  <div className="flex flex-wrap gap-2">
                    <label className="secondary-action pressable cursor-pointer">
                      {say("pm_replace")}
                      <input accept="image/png,image/jpeg,image/webp" className="sr-only" data-keep-original name="promptpay_qr" onChange={(event) => void pickQr(event.target.files?.[0])} type="file" />
                    </label>
                    <button
                      className="secondary-action pressable"
                      onClick={() => {
                        setRemovePromptPayQr(true);
                        setPromptPayQrUrl("");
                      }}
                      style={{ color: "var(--danger)" }}
                      type="button"
                    >
                      {say("pm_remove")}
                    </button>
                  </div>
                </div>
              ) : (
                <label className="secondary-action pressable mt-2 w-full cursor-pointer sm:w-auto">
                  {qrFileName ? say("pm_replace") : say("pm_addQr")}
                  <input accept="image/png,image/jpeg,image/webp" className="sr-only" data-keep-original name="promptpay_qr" onChange={(event) => void pickQr(event.target.files?.[0])} type="file" />
                </label>
              )}
              {qrFileName ? <p className="mt-2 font-semibold text-[var(--success)]">{say("pm_qrChosen", { file: qrFileName })}</p> : null}
              {qrFileName && qrText ? (
                <p className={`mt-1 text-[14px] font-medium ${qrText === "none" ? "text-[var(--warning)]" : "text-[var(--foreground-secondary)]"}`}>{say(qrText === "none" ? "pm_qrNotRead" : "pm_qrRead")}</p>
              ) : null}
            </div>
          </div>
        </MethodCard>
        ) : null}
        <MethodCard checked={enabledMethods.includes("bank_transfer")} label={say("pm_bankName")} name="bank_transfer" onToggle={toggleMethod}>
          <div className="mt-3 grid gap-3">
            <label className="block">
              <span className={labelClass}>{say("pm_bank")}</span>
              <input className="mt-1 w-full" defaultValue={settings.bank_name || ""} name="bank_name" placeholder={say("pm_bankPh")} />
            </label>
            <label className="block">
              <span className={labelClass}>{say("pm_accNo")}</span>
              <input className="mt-1 w-full" defaultValue={settings.bank_account_number || ""} inputMode="numeric" name="bank_account_number" />
            </label>
            <label className="block">
              <span className={labelClass}>{say("pm_accName")}</span>
              <input className="mt-1 w-full" defaultValue={settings.bank_account_name || ""} name="bank_account_name" />
            </label>
          </div>
        </MethodCard>
        <MethodCard checked={enabledMethods.includes("wise")} label={say("pay_wise")} name="wise" onToggle={toggleMethod}>
          <label className="mt-3 block">
            <span className={labelClass}>{say("pm_wiseLink")}</span>
            <input className="mt-1 w-full" defaultValue={settings.wise_link || ""} name="wise_link" placeholder="wise.com/pay/me/yourname" />
          </label>
        </MethodCard>
        <MethodCard checked={enabledMethods.includes("revolut")} label={say("pay_revolut")} name="revolut" onToggle={toggleMethod}>
          <label className="mt-3 block">
            <span className={labelClass}>{say("pm_revolutLink")}</span>
            <input className="mt-1 w-full" defaultValue={settings.revolut_link || ""} name="revolut_link" placeholder="revolut.me/yourname" />
          </label>
        </MethodCard>
        <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5 opacity-70">
          <p className="text-[16px] font-bold text-[var(--foreground)]">{say("pm_card")}</p>
          <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{say("pm_cardBody")}</p>
        </div>
      </div>

      <div className="pt-2">
        <p className="text-[16px] font-bold text-[var(--foreground)]">{say("pm_receipts")}</p>
        <div className="mt-2.5 grid gap-3 lg:grid-cols-2">
          <label className="block">
            <span className={labelClass}>{say("pm_prefix")}</span>
            <input className="mt-1 w-full" maxLength={6} name="receipt_prefix" onChange={(event) => setReceiptPrefix(event.target.value)} value={receiptPrefix} />
            <span className={helpClass}>{say("pm_prefixHelp", { example: `${previewPrefix}-${new Date().getFullYear()}-0001` })}</span>
          </label>
          <label className="block">
            <span className={labelClass}>{say("pm_default")}</span>
            <select className="mt-1 w-full" name="default_payment_method" onChange={(event) => setDefaultMethod(event.target.value)} value={defaultMethod}>
              {enabledMethods.filter((method) => method !== "promptpay" || promptPay || defaultMethod === "promptpay").map((method) => (
                <option key={method} value={method}>
                  {methodName(method)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block">
          <span className={labelClass}>{say("pm_footer")}</span>
          <textarea className="mt-1 min-h-24 w-full" defaultValue={settings.receipt_footer_text || ""} name="receipt_footer_text" placeholder={say("pm_footerPh", { business: businessName })} />
        </label>
      </div>

      {result ? (
        <p className={`rounded-xl px-4 py-3 font-bold ${result === "saved" ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--danger-light)] text-[var(--danger)]"}`}>{result === "saved" ? say("pm_saved") : failReason || say("saveFailed")}</p>
      ) : null}

      <button className="primary-action w-full sm:w-auto" disabled={isPending} type="submit">
        {isPending ? say("saving") : say("pm_save")}
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
  description?: string;
  disabled?: boolean;
  label: string;
  name: string;
  onToggle?: (name: string, checked: boolean) => void;
}) {
  return (
    <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
      <SwitchField checked={checked} description={description} disabled={disabled} label={label} onChange={(event) => onToggle?.(name, event.target.checked)} />
      {checked ? children : null}
    </div>
  );
}
