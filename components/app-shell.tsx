"use client";

import {
  BarChart3,
  CalendarDays,
  Car,
  Calculator,
  FileText,
  Home,
  Plus,
  ReceiptText,
  Settings,
  Users
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getMyAppRole, signOut } from "@/app/actions/auth";
import { RouteHqLogo } from "@/components/brand-logo";
import { FastActionSheet } from "@/components/fast-action-sheet";
import { PendingButton } from "@/components/pending-button";
import { TrialBanner } from "@/components/trial-banner";

type NavItem = {
  label: string;
  href: Route;
  icon: typeof Home;
};

const mainNavItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Fleet", href: "/fleet", icon: Car },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings }
];

const operationsItems: NavItem[] = [
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Bookings", href: "/bookings", icon: CalendarDays },
  { label: "Transactions", href: "/transactions", icon: ReceiptText },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Rental Calculator", href: "/rental-calculator", icon: Calculator }
];

export function AppShell({ children, userEmail }: { children: React.ReactNode; userEmail?: string | null }) {
  const [fastActionOpen, setFastActionOpen] = useState(false);
  const pathname = usePathname();

  // Teammates cannot use business settings, so the link is hidden for them.
  // Display only: the middleware and server actions enforce the rule.
  const [isTeammate, setIsTeammate] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getMyAppRole()
      .then((role) => {
        if (!cancelled) setIsTeammate(role === "teammate");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const visibleMainNavItems = isTeammate ? mainNavItems.filter((item) => item.href !== "/settings") : mainNavItems;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-[220px] flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-3 py-4 lg:flex">
        <div className="mb-6 flex items-center rounded-2xl border border-white/10 bg-[var(--sidebar-darker)]/70 p-3 shadow-[0_18px_35px_rgba(0,0,0,0.16)]">
          <RouteHqLogo tone="dark" />
        </div>
        <nav className="flex-1 space-y-1">
          <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.08em] text-[var(--sidebar-text-muted)]">Main</p>
          {visibleMainNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  isActive(item.href)
                    ? "text-white shadow-[0_12px_24px_rgba(18,184,200,0.25)]"
                    : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white"
                }`}
                href={item.href}
                key={item.label}
                style={isActive(item.href) ? { background: 'linear-gradient(135deg, #12BCB8 0%, #1F6BFF 100%)' } : undefined}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
          <p className="mb-2 mt-5 px-3 text-[11px] font-black uppercase tracking-[0.08em] text-[var(--sidebar-text-muted)]">Operations</p>
          {operationsItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  isActive(item.href)
                    ? "text-white shadow-[0_12px_24px_rgba(18,184,200,0.25)]"
                    : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white"
                }`}
                href={item.href}
                key={item.label}
                style={isActive(item.href) ? { background: 'linear-gradient(135deg, #12BCB8 0%, #1F6BFF 100%)' } : undefined}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {userEmail ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-[var(--sidebar-darker)]/70 p-3">
            <Link className="block truncate text-xs font-semibold text-[var(--sidebar-text-muted)] hover:text-white" href="/account">
              {userEmail}
            </Link>
            <Link className="mt-1 block text-[11px] font-bold text-[var(--sidebar-text)] hover:text-white" href="/account">
              My account
            </Link>
            <form action={signOut} className="mt-3">
              <PendingButton className="inline-flex w-full items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15" pendingLabel="" type="submit">
                Sign out
              </PendingButton>
            </form>
          </div>
        ) : null}
      </aside>

      <main className="content-area mx-auto lg:ml-[220px] lg:max-w-none">
        {userEmail ? (
          <div className="mb-4 flex items-center justify-end gap-2 lg:hidden">
            <Link
              className="max-w-[180px] truncate rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground-secondary)] shadow-sm sm:max-w-none"
              href="/account"
            >
              {userEmail}
            </Link>
            <form action={signOut}>
              <PendingButton className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--sidebar-bg)] px-3 py-1.5 text-xs font-bold text-white" pendingLabel="" type="submit">
                Sign out
              </PendingButton>
            </form>
          </div>
        ) : null}
        <TrialBanner />
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] lg:hidden">
        <div className="grid grid-cols-5 px-2 py-2">
          {visibleMainNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] font-semibold ${
                  isActive(item.href) ? "text-[var(--primary)]" : "text-[var(--sidebar-text)]"
                }`}
                href={item.href}
                key={item.label}
              >
                <Icon size={16} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <button
        aria-label="Open fast actions"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-[0_18px_32px_rgba(18,184,200,0.35)] transition hover:bg-[var(--primary-hover)] lg:bottom-6 lg:right-6"
        onClick={() => setFastActionOpen(true)}
      >
        <Plus size={26} />
      </button>

      <FastActionSheet open={fastActionOpen} onClose={() => setFastActionOpen(false)} />
    </div>
  );
}
