"use client";

import { useState, useTransition } from "react";
import { shownError } from "@/lib/error-text";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RotateCcw, X } from "lucide-react";
import { undoCancellation } from "@/app/actions/bookings";

type Props = {
  rentalId: string;
  organizationId: string;
  vehicleId: string;
  customerName: string | null;
  compact?: boolean;
  label?: string;
};

export function UndoCancellationButton({
  rentalId,
  organizationId,
  vehicleId,
  customerName,
  compact = false,
  label,
}: Props) {
  const router = useRouter();
  const say = useTranslations("booking") as unknown as (key: string) => string;
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("organizationId", organizationId);
        fd.set("rentalId", rentalId);
        fd.set("vehicleId", vehicleId);
        await undoCancellation(fd);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(shownError(err, say("undo_failed")));
      }
    });
  }

  return (
    <>
      <button
        className={
          compact
            ? "pressable inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--primary)]"
            : "pressable inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--primary)]"
        }
        onClick={() => setOpen(true)}
        type="button"
      >
        <RotateCcw size={compact ? 14 : 15} />
        {label || say("undo_label")}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[var(--foreground)]/60 p-3 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white shadow-2xl">

            <div className="flex items-start gap-3 rounded-t-2xl border-b border-[var(--border)] bg-[var(--panel-secondary)] p-4">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-[var(--primary)]">
                <RotateCcw size={17} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase text-[var(--primary)]">{say("undo_label")}</p>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">
                  {customerName || say("undo_thisBooking")}
                </h3>
              </div>
              <button
                className="pressable rounded-lg p-1.5 text-[var(--muted)]"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
                <p className="text-xs font-semibold uppercase text-[var(--muted)]">{say("undo_restores")}</p>
                {[
                  say("undo_l1"),
                  say("undo_l2"),
                  say("undo_l3"),
                  say("undo_l4"),
                ].map((line, i) => (
                  <div className="flex items-start gap-2 text-sm text-[var(--foreground)]" key={i}>
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                    {line}
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-[var(--warning-line)] bg-[var(--warning-light)] p-3">
                <p className="text-xs font-bold text-[var(--warning)]">
                  ⚠️ {say("undo_warning")}
                </p>
              </div>

              {error && (
                <p className="rounded-xl bg-[var(--danger-light)] px-3 py-2 text-sm font-bold text-[var(--danger)]">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  className="pressable inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-bold text-[var(--foreground-secondary)]"
                  disabled={isPending}
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  {say("undo_back")}
                </button>
                <button
                  className="pressable inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-70"
                  disabled={isPending}
                  onClick={submit}
                  type="button"
                >
                  {isPending ? say("undo_restoring") : say("undo_confirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
