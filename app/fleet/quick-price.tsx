"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoneyInput } from "@/components/money-input";

/**
 * "Set price" on the fleet list opens a small box: per day, week or month, an amount, Save (Rory, 31 Oct 2026).
 * It sits on the page (portalled), so the table's scrolling doesn't clip it.
 */
export function QuickPrice({
  vehicleId,
  currency,
  saveAction
}: {
  vehicleId: string;
  currency: string;
  saveAction: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
}) {
  const t = useTranslations("fleet");
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [rate, setRate] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const place = () => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const width = 288;
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const close = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!box.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("touchstart", close);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("touchstart", close);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <>
      <button
        aria-expanded={open}
        className="block whitespace-nowrap font-semibold text-[var(--primary)] hover:underline"
        onClick={() => {
          setError("");
          setOpen((value) => !value);
        }}
        ref={trigger}
        type="button"
      >
        {t("setPrice")}
      </button>
      {open
        ? createPortal(
            <form
              action={(formData) =>
                start(async () => {
                  const result = await saveAction(formData);
                  if (!result.success) {
                    setError(result.error || t("qp_failed"));
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                })
              }
              className="fixed z-[80] grid w-72 gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-xl"
              ref={box}
              role="dialog"
              style={{ top: pos.top, left: pos.left }}
            >
              <input name="vehicleId" type="hidden" value={vehicleId} />
              <span className="font-semibold text-[var(--foreground)]">{t("qp_title")}</span>
              <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                <MoneyInput currency={currency} name="rate" onValueChange={setRate} />
                <select aria-label={t("qp_period")} className="mt-1 h-11" defaultValue="month" name="period">
                  <option value="day">{t("qp_day")}</option>
                  <option value="week">{t("qp_week")}</option>
                  <option value="month">{t("qp_month")}</option>
                </select>
              </div>
              {error ? <p className="text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
              <div className="flex gap-2">
                <button className="primary-action flex-1 justify-center" disabled={pending || !rate} type="submit">
                  {pending ? "…" : t("qp_save")}
                </button>
                <button className="secondary-action pressable justify-center" onClick={() => setOpen(false)} type="button">
                  {t("qp_cancel")}
                </button>
              </div>
            </form>,
            document.body
          )
        : null}
    </>
  );
}
