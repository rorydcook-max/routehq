"use client";

import { Car, CarFront, ClipboardCheck, ReceiptText, RotateCcw, UploadCloud, UserPlus, X } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useEffect } from "react";

type Action = { label: string; href: Route; icon: typeof Car; detail: string };

// The four things an owner does most days come first, in the order a rental happens.
const everyday: Action[] = [
  { label: "New booking", href: "/bookings/new", icon: CarFront, detail: "Pick the vehicle, customer and dates" },
  { label: "Hand over a vehicle", href: "/inspections/start/delivery" as Route, icon: ClipboardCheck, detail: "Photos, fuel and signature as it goes out" },
  { label: "Take a vehicle back", href: "/inspections/start/return" as Route, icon: RotateCcw, detail: "Check it in and settle the deposit" },
  { label: "Record money in or out", href: "/transactions/new", icon: ReceiptText, detail: "A payment you received or a cost you paid" }
];

const lessOften: Action[] = [
  { label: "Add a customer", href: "/customers/new" as Route, icon: UserPlus, detail: "Name, phone and documents" },
  { label: "Add a vehicle", href: "/fleet/new", icon: Car, detail: "Details, prices and paperwork" },
  { label: "Import vehicles", href: "/fleet/import", icon: UploadCloud, detail: "From a spreadsheet or Google Sheets" }
];

export function FastActionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    return (
      <Link
        className="action-tile flex items-center gap-3 p-3 text-left transition hover:border-[var(--primary)] hover:bg-[var(--primary-light)]"
        href={action.href}
        key={action.label}
        onClick={onClose}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
          <Icon size={20} />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-[var(--foreground)]">{action.label}</span>
          <span className="block text-sm text-[var(--muted)]">{action.detail}</span>
        </span>
      </Link>
    );
  };

  return (
    // Phones: slides up from the bottom, by the thumb. Computers: a box in the middle of the screen.
    <div className="fixed inset-0 z-50 flex items-end bg-[#10252b]/40 lg:items-center lg:justify-center" onClick={onClose}>
      <div
        aria-label="Quick add"
        aria-modal="true"
        className="surface-panel max-h-[85vh] w-full overflow-y-auto rounded-t-3xl p-4 pb-6 shadow-xl lg:w-[440px] lg:rounded-2xl lg:pb-4"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--foreground)]">What would you like to do?</h2>
          <button aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--foreground-secondary)]" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-2">
          {everyday.map(row)}
          <p className="mt-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Less often</p>
          {lessOften.map(row)}
        </div>
      </div>
    </div>
  );
}
