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
  MessagesSquare,
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
import { AskBox } from "@/components/ask-box";
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
  | "inbox"
  | "tasks"
  | "transactions"
  | "documents"
  | "rentalCalculator";

type NavItem = {
  key: NavKey;
  href: Route;
  icon: typeof Home;
};

// What an owner opens every day, in the order the day goes.
const dailyItems: NavItem[] = [
  { key: "dashboard", href: "/", icon: Home },
  { key: "tasks", href: "/tasks", icon: ListChecks },
  { key: "inbox", href: "/inbox", icon: MessagesSquare },
  { key: "bookings", href: "/bookings", icon: ClipboardList },
  { key: "calendar", href: "/calendar", icon: CalendarDays },
  { key: "fleet", href: "/fleet", icon: Car },
  { key: "customers", href: "/customers", icon: Users }
];

// Looked at now and then: money, paperwork and set-up.
const recordItems: NavItem[] = [
  { key: "transactions", href: "/transactions", icon: ReceiptText },
  { key: "reports", href: "/reports", icon: BarChart3 },
  { key: "documents", href: "/documents", icon: FileText },
  { key: "rentalCalculator", href: "/rental-calculator", icon: Calculator },
  { key: "settings", href: "/settings", icon: Settings }
];

// Phones get the four places used most every day; everything else is under More.
const mobileBarKeys: NavKey[] = ["dashboard", "tasks", "inbox", "bookings"];

export function AppShell({ children, userEmail }: { children: React.ReactNode; userEmail?: string | null }) {
  const t = useTranslations("nav");
  const [fastActionOpen, setFastActionOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();

  // Teammates cannot use business settings, so the link is hidden for them.
  // Display only: the middleware and server actions enforce the rule.
  const [shell, setShell] = useState<ShellContext>({ role: null, organizations: [], unreadChats: 0 });
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
  const visibleRecordItems = isTeammate ? recordItems.filter((item) => item.href !== "/settings") : recordItems;
  const allNavItems = [...dailyItems, ...visibleRecordItems];
  const mobileBarItems = mobileBarKeys.map((key) => allNavItems.find((item) => item.key === key)).filter(Boolean) as NavItem[];
  const moreItems = allNavItems.filter((item) => !mobileBarKeys.includes(item.key));

  const onFocusedFlow = !!pathname && (pathname.startsWith("/inspections") || /\/(new|edit|import)(\/|$)/.test(pathname));
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const moreActive = moreItems.some((item) => isActive(item.href));

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-[220px] flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-3 py-4 lg:flex">
        <div className="mb-4 flex items-center px-2 pt-1">
          <RouteHqLogo />
        </div>
        {!isTeammate ? <AskBox variant="sidebar" /> : null}
        <nav className="scrollbar-none min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {allNavItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                  index === dailyItems.length ? "!mt-3 " : ""
                }${
                  isActive(item.href)
                    ? "bg-[var(--primary-light)] text-[var(--primary)]"
                    : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]"
                }`}
                href={item.href}
                key={item.key}
              >
                <Icon size={16} />
                {t(item.key)}
                {item.key === "inbox" && shell.unreadChats > 0 ? (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-[11px] font-semibold text-white">{shell.unreadChats}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <TrialBanner placement="sidebar" />
        {userEmail ? (
          <div className="mt-3 rounded-xl border border-[var(--sidebar-border)] bg-white p-3">
            {hasSeveralBusinesses ? (
              <form action={switchActiveOrganization} className="mb-3">
                <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--sidebar-text-muted)]" htmlFor="business-switcher">
                  {t("business")}
                </label>
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-xs font-semibold text-[var(--foreground)]"
                  defaultValue={activeBusiness?.id}
                  id="business-switcher"
                  name="organizationId"
                  onChange={(event) => event.currentTarget.form?.requestSubmit()}
                >
                  {shell.organizations.map((organization) => (
                    <option className="text-[var(--foreground)]" key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </form>
            ) : null}
            <Link className="block truncate text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)]" href="/account">
              {userEmail}
            </Link>
            <Link className="mt-1 block text-[12px] font-semibold text-[var(--primary)] hover:underline" href="/account">
              {t("myAccount")}
            </Link>
            <form action={signOut} className="mt-3">
              <PendingButton className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] px-3 py-2 text-xs font-semibold text-[var(--foreground-secondary)] hover:bg-[var(--sidebar-darker)]" pendingLabel="" type="submit">
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
            <span className="ml-auto">{!isTeammate ? <AskBox variant="icon" /> : null}</span>
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
                <span className="relative">
                  <Icon size={18} />
                  {item.key === "inbox" && shell.unreadChats > 0 ? (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-semibold text-white">{shell.unreadChats}</span>
                  ) : null}
                </span>
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
            className="w-full rounded-t-2xl bg-white p-4 pb-8 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sidebar-text-muted)]">{t("more")}</p>
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
                      isActive(item.href) ? "bg-[var(--primary-light)] text-[var(--primary)]" : "bg-[var(--panel-secondary)] text-[var(--sidebar-text)]"
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
                className="flex flex-col items-center gap-1.5 rounded-xl bg-[var(--panel-secondary)] px-2 py-3 text-center text-xs font-semibold text-[var(--sidebar-text)]"
                href="/account"
                onClick={() => setMoreOpen(false)}
              >
                <CircleUserRound size={18} />
                <span>{t("myAccount")}</span>
              </Link>
            </div>
            {userEmail ? (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                <span className="min-w-0 truncate text-xs font-semibold text-[var(--sidebar-text-muted)]">{userEmail}</span>
                <form action={signOut}>
                  <PendingButton className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground)]" pendingLabel="" type="submit">
                    {t("signOut")}
                  </PendingButton>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* The quick-add button stays out of handovers and create/edit forms, where it only covers fields. */}
      {onFocusedFlow ? null : <button
        aria-label={t("openFastActions")}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-[0_8px_20px_rgba(15,118,110,0.28)] transition hover:bg-[var(--primary-hover)] lg:bottom-6 lg:right-6"
        onClick={() => setFastActionOpen(true)}
      >
        <Plus size={26} />
      </button>}

      <FastActionSheet open={fastActionOpen} onClose={() => setFastActionOpen(false)} />
    </div>
  );
}
