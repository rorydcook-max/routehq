"use client";

import {
  Car,
  CarFront,
  ClipboardCheck,
  FileSpreadsheet,
  RotateCcw,
  UploadCloud,
  ReceiptText
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

const actions: Array<{ label: string; href: Route; icon: typeof Car; detail: string }> = [
  { label: "Add New Booking", href: "/bookings/new", icon: CarFront, detail: "Vehicle, customer, dates, deposit" },
  { label: "Add New Vehicle", href: "/fleet/new", icon: Car, detail: "Specs, rates, finance, documents" },
  { label: "Add Transaction", href: "/transactions/new", icon: ReceiptText, detail: "Income, expense, deposit, refund" },
  { label: "Complete Task", href: "/calendar", icon: ClipboardCheck, detail: "Pickup, delivery, maintenance run" }
];

const setupActions: Array<{ label: string; href: Route; icon: typeof Car; detail: string }> = [
  { label: "Start Delivery Inspection", href: "/inspections/start/delivery" as Route, icon: ClipboardCheck, detail: "Choose a booked rental" },
  { label: "Start Return Inspection", href: "/inspections/start/return" as Route, icon: RotateCcw, detail: "Choose an active rental" },
  { label: "Import vehicles", href: "/fleet/import", icon: UploadCloud, detail: "Files, Google Sheets, AI mapping" }
];

export function FastActionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <div
        className="surface-panel absolute bottom-0 left-0 right-0 max-h-[82vh] overflow-y-auto rounded-t-3xl p-4 shadow-xl lg:bottom-6 lg:left-auto lg:right-6 lg:w-96 lg:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--primary)]">Fast mobile workflow</p>
            <h2 className="text-xl font-black tracking-[-0.02em] text-[var(--foreground)]">What are we adding?</h2>
          </div>
          <button className="rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--foreground-secondary)]" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="grid gap-2">
          {actions.map((action) => {
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
                <span>
                  <span className="block font-semibold text-[var(--foreground)]">{action.label}</span>
                  <span className="block text-sm text-[var(--muted)]">{action.detail}</span>
                </span>
              </Link>
            );
          })}
          <p className="mt-3 px-1 text-xs font-black uppercase tracking-[0.08em] text-[var(--muted)]">Setup</p>
          {setupActions.map((action) => {
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
                <span>
                  <span className="block font-semibold text-[var(--foreground)]">{action.label}</span>
                  <span className="block text-sm text-[var(--muted)]">{action.detail}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
