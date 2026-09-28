"use client";

import {
  BarChart3,
  CalendarDays,
  Car,
  Calculator,
  CircleUserRound,
  FileText,
  Home,
  Plus,
  ClipboardList,
  ListChecks,
  MoreHorizontal,
  ReceiptText,
  Settings,
  Users,
  X
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getShellContext, signOut, switchActiveOrganization, type ShellContext } from "@/app/actions/auth";
import { RouteHqLogo } from "@/components/brand-logo";
import { FastActionSheet } from "@/components/fast-action-sheet";
import { PendingButton } from "@/components/pending-button";
import { TrialBanner } from "@/components/trial-banner";

type NavKey =
  | "dashboard"
  | "fleet"
  | "calendar"
  | "reports"
  | "settings"
  | "customers"
  | "bookings"
  | "tasks"
  | "transactions"
  | "documents"
  | "rentalCalculator";

type NavItem = {
  key: NavKey;
  href: Route;
  icon: typeof Home;
};

const mainNavItems: NavItem[] = [
  { key: "dashboard", href: "/", icon: Home },
  { key: "fleet", href: "/fleet", icon: Car },
  { key: "calendar", href: "/calendar", icon: CalendarDays },
  { key: "reports", href: "/reports", icon: BarChart3 },
  { key: "settings", href: "/settings", icon: Settings }
];

const operationsItems: NavItem[] = [
  { key: "customers", href: "/customers", icon: Users },
  { key: "bookings", href: "/bookings", icon: ClipboardList },
  { key: "tasks", href: "/tasks", icon: ListChecks },
  { key: "transactions", href: "/transactions", icon: ReceiptText },
  { key: "documents", href: "/documents", icon: FileText },
  { key: "rentalCalculator", href: "/rental-calculator", icon: Calculator }
];

// Phones get the four places used most every day; everything else is under More.
const mobileBarKeys: NavKey[] = ["dashboard", "bookings", "fleet", "calendar"];

export function AppShell({ children, userEmail }: { children: React.ReactNode; userEmail?: string | null }) {
  const t = useTranslations("nav");
  const [fastActionOpen, setFastActionOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();

  // Teammates cannot use business settings, so the link is hidden for them.
  // Display only: the middleware and server actions enforce the rule.
  const [shell, setShell] = useState<ShellContext>({ role: null, organizations: [] });
  useEffect(() => {
    let cancelled = false;
    getShellContext()
      .then((context) => {
        if (!cancelled) setShell(context);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const isTeammate = shell.role === "teammate";
  const hasSeveralBusinesses = shell.organizations.length > 1;
  const activeBusiness = shell.organizations.find((organization) => organization.active);
  const visibleMainNavItems = isTeammate ? mainNavItems.filter((item) => item.href !== "/settings") : mainNavItems;
  const allNavItems = [...visibleMainNavItems, ...operationsItems];
  const mobileBarItems = mobileBarKeys.map((key) => allNavItems.find((item) => item.key === key)).filter(Boolean) as NavItem[];
  const moreItems = allNavItems.filter((item) => !mobileBarKeys.includes(item.key));

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const moreActive = moreItems.some((item) => isActive(item.href));

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-[220px] flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-3 py-4 lg:flex">
        <div className="mb-4 flex items-center rounded-2xl border border-white/10 bg-[var(--sidebar-darker)]/70 p-3 shadow-[0_18px_35px_rgba(0,0,0,0.16)]">
          <RouteHqLogo tone="dark" />
        </div>
        <nav className="scrollbar-none min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.08em] text-[var(--sidebar-text-muted)]">{t("main")}</p>
          {visibleMainNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                  isActive(item.href)
                    ? "text-white shadow-[0_12px_24px_rgba(18,184,200,0.25)]"
                    : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white"
                }`}
                href={item.href}
                key={item.key}
                style={isActive(item.href) ? { background: 'linear-gradient(135deg, #12BCB8 0%, #1F6BFF 100%)' } : undefined}
              >
                <Icon size={16} />
                {t(item.key)}
              </Link>
            );
          })}
          <p className="mb-2 mt-4 px-3 text-[11px] font-black uppercase tracking-[0.08em] text-[var(--sidebar-text-muted)]">{t("operations")}</p>
          {operationsItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                  isActive(item.href)
                    ? "text-white shadow-[0_12px_24px_rgba(18,184,200,0.25)]"
                    : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white"
                }`}
                href={item.href}
                key={item.key}
                style={isActive(item.href) ? { background: 'linear-gradient(135deg, #12BCB8 0%, #1F6BFF 100%)' } : undefined}
              >
                <Icon size={16} />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <TrialBanner placement="sidebar" />
        {userEmail ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-[var(--sidebar-darker)]/70 p-3">
            {hasSeveralBusinesses ? (
              <form action={switchActiveOrganization} className="mb-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.08em] text-[var(--sidebar-text-muted)]" htmlFor="business-switcher">
                  {t("business")}
                </label>
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-xs font-semibold text-white"
                  defaultValue={activeBusiness?.id}
                  id="business-switcher"
                  name="organizationId"
                  onChange={(event) => event.currentTarget.form?.requestSubmit()}
                >
                  {shell.organizations.map((organization) => (
                    <option className="text-[#10252b]" key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </form>
            ) : null}
            <Link className="block truncate text-xs font-semibold text-[var(--sidebar-text-muted)] hover:text-white" href="/account">
              {userEmail}
            </Link>
            <Link className="mt-1 block text-[11px] font-bold text-[var(--sidebar-text)] hover:text-white" href="/account">
              {t("myAccount")}
            </Link>
            <form action={signOut} className="mt-3">
              <PendingButton className="inline-flex w-full items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15" pendingLabel="" type="submit">
                {t("signOut")}
              </PendingButton>
            </form>
          </div>
        ) : null}
      </aside>

      <main className="content-area mx-auto lg:ml-[220px] lg:max-w-none">
        {userEmail ? (
          // Phones: logo and (for people in several businesses) the switcher.
          // Account and sign-out live under More, away from thumbs.
          <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
            <Link aria-label="RouteHQ dashboard" href="/">
              <RouteHqLogo className="h-7 w-auto" showDescriptor={false} />
            </Link>
            {hasSeveralBusinesses ? (
              <form action={switchActiveOrganization}>
                <select
                  aria-label={t("business")}
                  className="max-w-[150px] truncate rounded-full border border-[var(--border)] bg-white px-2 py-1.5 text-xs font-semibold text-[var(--foreground-secondary)] shadow-sm"
                  defaultValue={activeBusiness?.id}
                  name="organizationId"
                  onChange={(event) => event.currentTarget.form?.requestSubmit()}
                >
                  {shell.organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </form>
            ) : null}
          </div>
        ) : null}
        <TrialBanner />
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] lg:hidden">
        <div className="grid grid-cols-5 px-2 py-2">
          {mobileBarItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] font-semibold ${
                  isActive(item.href) ? "text-[var(--primary)]" : "text-[var(--sidebar-text)]"
                }`}
                href={item.href}
                key={item.key}
              >
                <Icon size={16} />
                <span className="truncate">{t(item.key)}</span>
              </Link>
            );
          })}
          <button
            aria-expanded={moreOpen}
            className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] font-semibold ${
              moreActive || moreOpen ? "text-[var(--primary)]" : "text-[var(--sidebar-text)]"
            }`}
            onClick={() => setMoreOpen(true)}
            type="button"
          >
            <MoreHorizontal size={16} />
            <span className="truncate">{t("more")}</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[#10252b]/50 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div
            className="w-full rounded-t-2xl bg-[var(--sidebar-bg)] p-4 pb-8 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--sidebar-text-muted)]">{t("more")}</p>
              <button aria-label={t("close")} className="rounded-lg p-1.5 text-[var(--sidebar-text)]" onClick={() => setMoreOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center text-xs font-semibold ${
                      isActive(item.href) ? "bg-white/15 text-white" : "bg-white/5 text-[var(--sidebar-text)]"
                    }`}
                    href={item.href}
                    key={item.key}
                    onClick={() => setMoreOpen(false)}
                  >
                    <Icon size={18} />
                    <span>{t(item.key)}</span>
                  </Link>
                );
              })}
              <Link
                className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 px-2 py-3 text-center text-xs font-semibold text-[var(--sidebar-text)]"
                href="/account"
                onClick={() => setMoreOpen(false)}
              >
                <CircleUserRound size={18} />
                <span>{t("myAccount")}</span>
              </Link>
            </div>
            {userEmail ? (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                <span className="min-w-0 truncate text-xs font-semibold text-[var(--sidebar-text-muted)]">{userEmail}</span>
                <form action={signOut}>
                  <PendingButton className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white" pendingLabel="" type="submit">
                    {t("signOut")}
                  </PendingButton>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        aria-label={t("openFastActions")}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-[0_18px_32px_rgba(18,184,200,0.35)] transition hover:bg-[var(--primary-hover)] lg:bottom-6 lg:right-6"
        onClick={() => setFastActionOpen(true)}
      >
        <Plus size={26} />
      </button>

      <FastActionSheet open={fastActionOpen} onClose={() => setFastActionOpen(false)} />
    </div>
  );
}
