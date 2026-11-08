"use client";

import { Camera, Car, CarFront, ClipboardCheck, ReceiptText, RotateCcw, Sparkles, UploadCloud, UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Route } from "next";
import { useEffect } from "react";
import { openChat } from "@/lib/chat-suggestions";

type Action = { key: string; href: Route; icon: typeof Car; /** Opens the live chat instead of a page. */ chat?: boolean };

// The four things an owner does most days come first, in the order a rental happens.
const everyday: Action[] = [
  { key: "newBooking", href: "/bookings/new", icon: CarFront },
  { key: "handOver", href: "/inspections/start/delivery" as Route, icon: ClipboardCheck },
  { key: "takeBack", href: "/inspections/start/return" as Route, icon: RotateCcw },
  { key: "recordMoney", href: "/transactions/new", icon: ReceiptText },
  // A photo first, then where it goes: a new entry, one already recorded, or a payment being waited for (Rory, 1 Nov 2026).
  { key: "uploadReceipt", href: "/receipts/new" as Route, icon: Camera }
];

const lessOften: Action[] = [
  { key: "addCustomer", href: "/customers/new" as Route, icon: UserPlus },
  { key: "addVehicle", href: "/fleet/new", icon: Car },
  // Vehicles or who's renting now, by typing or photos (Rory, 2 Nov 2026): the live chat does it now (3 Nov 2026).
  { key: "askAssistant", href: "/fleet" as Route, icon: Sparkles, chat: true },
  { key: "importVehicles", href: "/fleet/import", icon: UploadCloud }
];

export function FastActionSheet({ open, onClose, canImport = false }: { open: boolean; onClose: () => void; canImport?: boolean }) {
  const t = useTranslations("shell");
  // Only the owner can import (the import page turns teammates away), so teammates aren't offered it.
  const lessOftenShown = canImport ? lessOften : lessOften.filter((action) => action.key !== "importVehicles");
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const row = (action: Action) => {
    const Icon = action.icon;
    const className = "sheet-row flex min-h-[60px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-[var(--primary-light)]";
    const inside = (
      <>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
          <Icon size={20} />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-[var(--foreground)]">{t(`quick_${action.key}`)}</span>
        </span>
      </>
    );
    if (action.chat) {
      return (
        <button
          className={className}
          key={action.key}
          onClick={() => {
            onClose();
            openChat();
          }}
          type="button"
        >
          {inside}
        </button>
      );
    }
    return (
      <Link className={className} href={action.href} key={action.key} onClick={onClose}>
        {inside}
      </Link>
    );
  };

  return (
    // Phones: slides up from the bottom, by the thumb. Computers: a box in the middle of the screen.
    <div className="sheet-scrim fixed inset-0 z-50 flex items-end bg-[var(--foreground)]/40 lg:items-center lg:justify-center" onClick={onClose}>
      {/* Phones: an iPhone-style sheet (frosted, rounded top, grabber). Computers: a box in the middle. */}
      <div
        aria-label={t("quickTitle")}
        aria-modal="true"
        className="surface-panel phone-sheet max-h-[85vh] w-full overflow-y-auto rounded-t-3xl p-4 pb-6 shadow-xl lg:w-[440px] lg:rounded-2xl lg:pb-4"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <span aria-hidden="true" className="sheet-grabber lg:hidden" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="sheet-title">{t("quickTitle")}</h2>
          <button aria-label={t("close")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--panel-secondary)] text-[var(--foreground-secondary)]" onClick={onClose} type="button">
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>
        {/* Two groups, each one rounded list like an iPhone settings group. */}
        <div className="sheet-group grid">{everyday.map(row)}</div>
        <p className="mb-1.5 mt-4 px-1 font-semibold text-[var(--muted)]">{t("quickLessOften")}</p>
        <div className="sheet-group grid">{lessOftenShown.map(row)}</div>
      </div>
    </div>
  );
}
