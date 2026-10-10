"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { creditExtrasToRent, moveExtrasToRent, refundExtras, removeExtras } from "@/app/actions/extras";

type Say = (key: string, values?: Record<string, string | number>) => string;
type Line = { name: string; amount: number; index: number };
type Form = "move" | "remove" | "refund" | "credit" | null;

type Props = {
  rentalId: string;
  organizationId: string;
  currency: string;
  lines: Line[];
  removedNames: string[];
  open: number;
  /** Unpaid extras still in their own payment, which can go onto the next rent. */
  openOwn: number;
  paid: number;
  refunded: number;
  credited: number;
  available: number;
  /** The next rent still to come, as words ("20 Oct · ฿13,200"), or null when there is none. */
  nextRent: string | null;
};

function money(value: number, currency = "THB") {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

/**
 * Paid extras on a booking: what was picked, what has been paid for them, and
 * what the owner can do: add unpaid extras to the next rent, take extras off,
 * refund what was paid for them, or take it off the rent still to come.
 */
export function ExtrasPanel({ rentalId, organizationId, currency, lines, removedNames, open, openOwn, paid, refunded, credited, available, nextRent }: Props) {
  const router = useRouter();
  const say = useTranslations("booking") as unknown as Say;
  const [form, setForm] = useState<Form>(null);
  const [picked, setPicked] = useState<number[]>(lines.map((line) => line.index));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(next: Form) {
    setError(null);
    setMessage(null);
    if (next === "remove") setPicked(lines.map((line) => line.index));
    setForm((current) => (current === next ? null : next));
  }

  function send(action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>, formData: FormData, done: string) {
    formData.set("rentalId", rentalId);
    formData.set("organizationId", organizationId);
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError(result.error || say("ref_wrong"));
        return;
      }
      setForm(null);
      setMessage(done);
      router.refresh();
    });
  }

  const facts = [
    paid > 0 ? say("ex_paid", { amount: money(paid, currency) }) : null,
    open > 0 ? say("ex_open", { amount: money(open, currency) }) : null,
    refunded > 0 ? say("ex_refunded", { amount: money(refunded, currency) }) : null,
    credited > 0 ? say("ex_credited", { amount: money(credited, currency) }) : null
  ].filter(Boolean);

  const button = "secondary-action pressable min-h-10 px-3 text-sm";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-3" id="extras">
      <p className="text-xs font-bold text-[var(--muted)]">{say("ex_title")}</p>
      {lines.length ? (
        <ul className="mt-1 space-y-0.5 text-sm font-semibold text-[var(--foreground)]">
          {lines.map((line) => (
            <li className="flex justify-between gap-3" key={line.index}>
              <span>{line.name}</span>
              <span className="tabular-nums">{money(line.amount, currency)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{say("ex_none")}</p>
      )}
      {removedNames.length ? <p className="mt-1 text-sm text-[var(--muted)]">{say("ex_removedList", { names: removedNames.join(", ") })}</p> : null}
      {facts.length ? <p className="mt-2 text-sm text-[var(--foreground-secondary)]">{facts.join(" · ")}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {openOwn > 0 && nextRent ? (
          <button className={button} onClick={() => toggle("move")} type="button">
            {say("ex_move")}
          </button>
        ) : null}
        {lines.length ? (
          <button className={button} onClick={() => toggle("remove")} type="button">
            {say("ex_remove")}
          </button>
        ) : null}
        {available > 0 ? (
          <button className={button} onClick={() => toggle("refund")} type="button">
            {say("ex_refund", { amount: money(available, currency) })}
          </button>
        ) : null}
        {available > 0 && nextRent ? (
          <button className={button} onClick={() => toggle("credit")} type="button">
            {say("ex_credit")}
          </button>
        ) : null}
      </div>

      {form === "move" ? (
        <div className="mt-3 rounded-lg bg-[var(--panel-secondary)] p-3 text-sm">
          <p>{say("ex_moveText", { amount: money(openOwn, currency), next: nextRent || "" })}</p>
          <Actions isPending={isPending} label={say("ex_moveConfirm")} onCancel={() => setForm(null)} onConfirm={() => send(moveExtrasToRent, new FormData(), say("ex_moved"))} />
        </div>
      ) : null}

      {form === "remove" ? (
        <div className="mt-3 rounded-lg bg-[var(--panel-secondary)] p-3 text-sm">
          <p className="font-semibold">{say("ex_removeWhich")}</p>
          <div className="mt-2 space-y-1">
            {lines.map((line) => (
              <label className="flex items-center gap-2" key={line.index}>
                <input
                  checked={picked.includes(line.index)}
                  onChange={(event) => setPicked((current) => (event.target.checked ? [...current, line.index] : current.filter((item) => item !== line.index)))}
                  type="checkbox"
                />
                <span>
                  {line.name} · {money(line.amount, currency)}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[var(--muted)]">{paid > 0 ? say("ex_removeTextPaid") : say("ex_removeText")}</p>
          <Actions
            disabled={!picked.length}
            isPending={isPending}
            label={say("ex_removeConfirm")}
            onCancel={() => setForm(null)}
            onConfirm={() => {
              const formData = new FormData();
              formData.set("lines", JSON.stringify(picked));
              send(removeExtras, formData, say("ex_removed"));
            }}
          />
        </div>
      ) : null}

      {form === "refund" || form === "credit" ? (
        <form
          className="mt-3 rounded-lg bg-[var(--panel-secondary)] p-3 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            if (form === "refund") send(refundExtras, formData, say("ex_refundDone"));
            else send(creditExtrasToRent, formData, say("ex_creditDone"));
          }}
        >
          <p>{form === "refund" ? say("ex_refundText") : say("ex_creditText", { next: nextRent || "" })}</p>
          <label className="mt-2 block text-xs font-bold text-[var(--foreground-secondary)]">
            {say("ex_amount")}
            <input className="mt-1 w-full" defaultValue={available} key={form} max={available} min={1} name="amount" step="1" type="number" />
          </label>
          {form === "refund" ? (
            <>
              <label className="mt-3 block text-xs font-bold text-[var(--foreground-secondary)]">
                {say("ref_how")}
                <select className="mt-1 w-full" defaultValue="cash" name="paymentMethod">
                  <option value="cash">{say("ref_cash")}</option>
                  <option value="bank_transfer">{say("ref_bank")}</option>
                  <option value="promptpay">{say("ref_promptpay")}</option>
                </select>
              </label>
              <label className="mt-3 block text-xs font-bold text-[var(--foreground-secondary)]">
                {say("ref_reasonNotes")}
                <textarea className="mt-1 w-full" name="notes" placeholder={say("ex_refundWhy")} />
              </label>
            </>
          ) : null}
          <Actions isPending={isPending} label={form === "refund" ? say("ex_refundConfirm") : say("ex_creditConfirm")} onCancel={() => setForm(null)} submit />
        </form>
      ) : null}

      {message ? <p className="mt-3 rounded-lg bg-[var(--success-light)] px-3 py-2 text-sm font-semibold text-[var(--success)]">{message}</p> : null}
      {error ? <p className="mt-3 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

function Actions({ isPending, label, onCancel, onConfirm, submit, disabled }: { isPending: boolean; label: string; onCancel: () => void; onConfirm?: () => void; submit?: boolean; disabled?: boolean }) {
  const say = useTranslations("booking") as unknown as Say;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        className="primary-action pressable min-h-10 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending || disabled}
        onClick={submit ? undefined : onConfirm}
        type={submit ? "submit" : "button"}
      >
        {isPending ? say("saving") : label}
      </button>
      <button className="secondary-action pressable min-h-10 px-3 text-sm" disabled={isPending} onClick={onCancel} type="button">
        {say("cancelBtn")}
      </button>
    </div>
  );
}
