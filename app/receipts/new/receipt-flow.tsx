"use client";

import { Camera, Check, FilePlus2, Link2, Loader2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { attachReceipt } from "@/app/actions/receipts";
import { smallReceipt } from "@/components/receipt-attach";
import { setPendingReceipt } from "@/components/receipt-handoff";
import { toast } from "@/components/toast";
import { shortDate } from "@/lib/i18n/dates";

export type ReceiptEntry = { id: string; type: string; amount: number; date: string; who: string; vehicle: string; notes: string };
export type ReceiptPayment = { id: string; amount: number; due: string; who: string; vehicle: string };
type Choice = "new" | "entry" | "payment";

const baht = (value: number) => `฿${Math.round(value).toLocaleString("en-US")}`;

/** One photo, then one question: a new entry, an entry already recorded, or a payment being waited for. */
export function ReceiptFlow({ entries, payments }: { entries: ReceiptEntry[]; payments: ReceiptPayment[] }) {
  const t = useTranslations("money");
  const say = t as unknown as (key: string, values?: Record<string, string | number>) => string;
  const locale = useLocale();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [readAmount, setReadAmount] = useState<number | null>(null);
  const [reading, setReading] = useState(false);
  const [choice, setChoice] = useState<Choice>("new");
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function choose(original: File) {
    setPicked("");
    setReadAmount(null);
    setPreview(original.type.startsWith("image/") ? URL.createObjectURL(original) : "");
    const small = await smallReceipt(original);
    setFile(small);
    // The amount on the receipt puts the likely entry or payment first.
    setReading(true);
    try {
      const body = new FormData();
      body.set("file", small);
      const response = await fetch("/api/ocr/receipt", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.isReceipt && Number(data.amount) > 0) setReadAmount(Number(data.amount));
    } catch {
      // Reading is a help, not a step: everything still works without it.
    } finally {
      setReading(false);
    }
  }

  const byAmount = <T extends { amount: number }>(list: T[]) =>
    readAmount ? [...list].sort((a, b) => Number(Math.abs(b.amount - readAmount) < 1) - Number(Math.abs(a.amount - readAmount) < 1)) : list;
  const sortedEntries = useMemo(() => byAmount(entries), [entries, readAmount]); // eslint-disable-line react-hooks/exhaustive-deps
  const sortedPayments = useMemo(() => byAmount(payments), [payments, readAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  // A match on the amount: offer it straight away.
  useEffect(() => {
    if (!readAmount || picked) return;
    const entry = entries.find((item) => Math.abs(item.amount - readAmount) < 1);
    const payment = payments.find((item) => Math.abs(item.amount - readAmount) < 1);
    if (entry) {
      setChoice("entry");
      setPicked(entry.id);
    } else if (payment) {
      setChoice("payment");
      setPicked(payment.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readAmount]);

  async function go() {
    if (!file) return;
    if (choice === "new") {
      setPendingReceipt(file);
      router.push("/transactions/new?cost=1" as Route);
      return;
    }
    if (choice === "payment") {
      if (!picked) return;
      setPendingReceipt(file);
      router.push(`/transactions/new?rentalPaymentId=${picked}` as Route);
      return;
    }
    if (!picked) return;
    setBusy(true);
    const body = new FormData();
    body.set("transactionId", picked);
    body.set("receipt", file, file.name || "receipt.jpg");
    const result = await attachReceipt(body).catch(() => ({ ok: false as const, error: "" }));
    setBusy(false);
    if (!result.ok) {
      toast({ message: result.error || say("rc_failed"), tone: "problem" });
      return;
    }
    toast({ message: say("rc_saved") });
    router.push("/transactions" as Route);
  }

  const typeName = (type: string) => (t.has(`type_${type}`) ? say(`type_${type}`) : type.replace(/_/g, " "));
  const options: Array<{ key: Choice; icon: typeof Camera; title: string; hint: string; disabled?: boolean }> = [
    { key: "new", icon: FilePlus2, title: say("rc_new"), hint: say("rc_newHint") },
    { key: "entry", icon: Link2, title: say("rc_entry"), hint: entries.length ? say("rc_entryHint") : say("rc_entryNone"), disabled: !entries.length },
    { key: "payment", icon: Wallet, title: say("rc_payment"), hint: payments.length ? say("rc_paymentHint") : say("rc_paymentNone"), disabled: !payments.length }
  ];
  const ready = Boolean(file) && (choice === "new" || Boolean(picked)) && !busy;

  return (
    <div className="space-y-3">
      <input
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = "";
          if (chosen) void choose(chosen);
        }}
        ref={input}
        type="file"
      />

      <div className="card p-4">
        <div className="flex items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="h-16 w-16 shrink-0 rounded-xl border border-[var(--border)] object-cover" src={preview} />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
              <Camera size={26} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-bold text-[var(--foreground)]">{file ? (reading ? say("rc_reading") : readAmount ? say("rc_readAmount", { amount: baht(readAmount) }) : say("rc_chosen")) : say("rc_pick")}</p>
            <p className="mt-0.5 text-[14px] text-[var(--muted)]">{file ? say("rc_pickAnother") : say("rc_pickHint")}</p>
          </div>
        </div>
        <button className={`${file ? "secondary-action" : "primary-action"} pressable mt-3 w-full justify-center`} onClick={() => input.current?.click()} type="button">
          {reading ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
          {file ? say("rc_another") : say("rc_choose")}
        </button>
      </div>

      {file ? (
        <div className="card p-4">
          <p className="card-title">{say("rc_where")}</p>
          <div className="mt-3 grid gap-2" role="radiogroup">
            {options.map((option) => {
              const Icon = option.icon;
              const on = choice === option.key;
              return (
                <button
                  aria-checked={on}
                  className={`pressable flex items-center gap-3 rounded-2xl border p-3.5 text-left ${on ? "border-[var(--primary)] bg-[var(--primary-light)]" : "border-transparent bg-[var(--panel-secondary)]"} ${option.disabled ? "opacity-50" : ""}`}
                  disabled={option.disabled}
                  key={option.key}
                  onClick={() => {
                    setChoice(option.key);
                    if (option.key !== choice) setPicked("");
                  }}
                  role="radio"
                  type="button"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--panel)] text-[var(--primary)]">
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[var(--foreground)]">{option.title}</span>
                    <span className="block text-sm text-[var(--muted)]">{option.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {choice === "entry" || choice === "payment" ? (
            <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
              {(choice === "entry" ? sortedEntries : sortedPayments).map((item) => {
                const on = picked === item.id;
                const matches = readAmount !== null && Math.abs(item.amount - readAmount) < 1;
                const title = "type" in item ? `${typeName((item as ReceiptEntry).type)} · ${baht(item.amount)}` : baht(item.amount);
                const when = "date" in item ? shortDate((item as ReceiptEntry).date, locale) : (item as ReceiptPayment).due ? say("dueOn", { date: shortDate((item as ReceiptPayment).due, locale) }) : "";
                return (
                  <button
                    className={`pressable flex w-full items-start gap-3 rounded-2xl border p-3 text-left ${on ? "border-[var(--primary)] bg-[var(--primary-light)]" : "border-[var(--border)] bg-[var(--panel)]"}`}
                    key={item.id}
                    onClick={() => setPicked(item.id)}
                    type="button"
                  >
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)]"}`}>{on ? <Check size={13} strokeWidth={3} /> : null}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-[var(--foreground)]">
                        {title}
                        {matches ? <span className="ml-2 rounded-full bg-[var(--success-light)] px-2 py-0.5 text-xs font-bold text-[var(--success)]">{say("rc_sameAmount")}</span> : null}
                      </span>
                      <span className="block text-sm text-[var(--muted)]">{[when, item.who, item.vehicle].filter(Boolean).join(" · ")}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <button className="primary-action pressable mt-4 w-full justify-center" disabled={!ready} onClick={() => void go()} type="button">
            {busy ? <Loader2 className="animate-spin" size={18} /> : null}
            {choice === "entry" ? say("rc_attach") : say("rc_continue")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
