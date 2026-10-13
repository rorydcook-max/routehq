"use client";

import {
  BarChart3,
  CalendarDays,
  Car,
  Calculator,
  CircleUserRound,
  FileText,
  Handshake,
  LifeBuoy,
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
import { useEffect, useState, Fragment } from "react";
import { getShellContext, signOut, switchActiveOrganization, type ShellContext } from "@/app/actions/auth";
import { AskBox } from "@/components/ask-box";
import { RouteHqLogo } from "@/components/brand-logo";
import { BrandStyle } from "@/components/brand-style";
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
  | "rentalCalculator"
  | "partners"
  | "help";

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
  { key: "customers", href: "/customers", icon: Users },
  { key: "partners", href: "/partners" as Route, icon: Handshake }
];

// Looked at now and then: money, paperwork and set-up.
const recordItems: NavItem[] = [
  { key: "transactions", href: "/transactions", icon: ReceiptText },
  { key: "reports", href: "/reports", icon: BarChart3 },
  { key: "documents", href: "/documents", icon: FileText },
  { key: "rentalCalculator", href: "/rental-calculator", icon: Calculator },
  { key: "settings", href: "/settings", icon: Settings },
  { key: "help", href: "/help" as Route, icon: LifeBuoy }
];

// Phones get the four places used most every day; everything else is under More.
// Rory, 6 Oct: To do and Inbox earn a place in the bar; Bookings is one tap away under More.
const mobileBarKeys: NavKey[] = ["dashboard", "tasks", "inbox"];

/**
 * `hero`: the teal band a page opens with (Lagoon look): on a phone it runs edge to edge behind the logo row,
 * on a computer it is a rounded block at the top of the page.
 */
export function AppShell({ children, userEmail, hero, heroOverlap = false }: { children: React.ReactNode; userEmail?: string | null; hero?: React.ReactNode; heroOverlap?: boolean }) {
  const t = useTranslations("nav");
  const [fastActionOpen, setFastActionOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();

  // Teammates cannot use business settings, so the link is hidden for them.
  // Display only: the middleware and server actions enforce the rule.
  const [shell, setShell] = useState<ShellContext>({ role: null, organizations: [], unreadChats: 0, dueTasks: 0, helpReplies: 0, brand: null });
  useEffect(() => {
    let cancelled = false;
    // The brand from last time, so their logo shows at once instead of RouteHQ's for a moment.
    try {
      const remembered = window.sessionStorage.getItem("routehq_shell_brand");
      if (remembered) setShell((current) => ({ ...current, brand: JSON.parse(remembered) }));
    } catch {
      // Storage can be unavailable; the fresh context arrives below anyway.
    }
    getShellContext()
      .then((context) => {
        if (cancelled) return;
        setShell(context);
        try {
          if (context.brand) window.sessionStorage.setItem("routehq_shell_brand", JSON.stringify(context.brand));
          else window.sessionStorage.removeItem("routehq_shell_brand");
        } catch {
          // Nothing to do: the logo just loads a moment later next time.
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const brand = shell.brand;
  const brandLogo = brand?.logoUrl ? (
    <span className="flex flex-col">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={brand.name} className="max-h-12 max-w-[190px] object-contain object-left" src={brand.logoUrl} />
      {brand.poweredBy ? <span className="mt-0.5 text-[10px] font-semibold text-[var(--sidebar-text-muted)]">Powered by RouteHQ</span> : null}
    </span>
  ) : null;
  const isTeammate = shell.role === "teammate" || shell.role === "manager";
  const hasSeveralBusinesses = shell.organizations.length > 1;
  const activeBusiness = shell.organizations.find((organization) => organization.active);
  const ownerOnly = ["/settings", "/reports", "/rental-calculator"];
  const visibleRecordItems = isTeammate ? recordItems.filter((item) => !ownerOnly.includes(item.href)) : recordItems;
  const allNavItems = [...dailyItems, ...visibleRecordItems];
  const mobileBarItems = mobileBarKeys.map((key) => allNavItems.find((item) => item.key === key)).filter(Boolean) as NavItem[];
  const moreItems = allNavItems.filter((item) => !mobileBarKeys.includes(item.key)).sort((a, b) => Number(b.key === "bookings") - Number(a.key === "bookings"));

  const onFocusedFlow = !!pathname && (pathname.startsWith("/inspections") || /\/(new|edit|import)(\/|$)/.test(pathname));
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const moreActive = moreItems.some((item) => isActive(item.href));
  const badgeFor = (key: NavKey) => (key === "inbox" ? shell.unreadChats : key === "tasks" ? shell.dueTasks : key === "help" ? shell.helpReplies : 0);

  return (
    <div className="min-h-screen pb-28 lg:pb-0">
      <BrandStyle colour={brand?.colour} />
      <aside className="app-sidebar fixed left-0 top-0 z-20 hidden h-screen w-[220px] flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-3 py-4 lg:flex">
        <div className="mb-4 flex items-center px-2 pt-1">
          {brandLogo || <RouteHqLogo />}
        </div>
        {!isTeammate ? <AskBox variant="sidebar" /> : null}
        {/* Quick add sits in the side menu on computers: floating over the page it covered the buttons at the end of each row. */}
        {onFocusedFlow ? null : (
          <button
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--primary-hover)]"
            onClick={() => setFastActionOpen(true)}
            type="button"
          >
            <Plus size={16} />
            {t("quickAdd")}
          </button>
        )}
        {/* On a short laptop screen the rows tighten so every link, Settings included, stays in view without scrolling. */}
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto [scrollbar-width:thin]">
          {allNavItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition [@media(max-height:920px)]:py-1 ${
                  index === dailyItems.length ? "!mt-3 [@media(max-height:920px)]:!mt-1.5 " : ""
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
                {badgeFor(item.key) > 0 ? (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-[11px] font-semibold text-white">{badgeFor(item.key)}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        {isTeammate ? null : <TrialBanner placement="sidebar" />}
        {userEmail ? (
          <div className="mt-3 rounded-xl border border-[var(--sidebar-border)] bg-white p-3">
            {hasSeveralBusinesses ? (
              <form action={switchActiveOrganization} className="mb-2">
                <select
                  aria-label={t("business")}
                  className="w-full rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-xs font-semibold text-[var(--foreground)]"
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
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <Link className="text-[12px] font-semibold text-[var(--primary)] hover:underline" href="/account">
                {t("myAccount")}
              </Link>
              <form action={signOut}>
                <PendingButton className="text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--foreground)] hover:underline" pendingLabel="" type="submit">
                  {t("signOut")}
                </PendingButton>
              </form>
            </div>
          </div>
        ) : null}
      </aside>

      <main className="content-area mx-auto lg:ml-[220px] lg:max-w-none">
        {(() => {
          const topRow = userEmail ? (
          // Phones: logo and (for people in several businesses) the switcher.
          // Account and sign-out live under More, away from thumbs.
          <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
            <Link aria-label={brand?.name || "RouteHQ dashboard"} href="/">
              {brand?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={brand.name} className={`h-8 max-w-[140px] object-contain object-left ${hero ? "rounded-md bg-white px-1.5 py-0.5" : ""}`} src={brand.logoUrl} />
              ) : (
                <RouteHqLogo className="h-7 w-auto" showDescriptor={false} tone={hero ? "dark" : "light"} />
              )}
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
          ) : null;
          return hero ? (
            <div className={`hero-band relative -mx-[14px] -mt-[14px] overflow-hidden rounded-b-[32px] bg-[var(--band)] px-[14px] pt-[14px] text-[var(--band-ink)] sm:-mx-6 sm:-mt-5 sm:px-6 lg:mx-0 lg:mt-0 lg:rounded-[28px] lg:px-8 lg:pt-7 ${heroOverlap ? "mb-0 pb-10 lg:pb-[72px]" : "mb-4 pb-6 lg:mb-5 lg:pb-7"}`}>
              <svg aria-hidden="true" className="band-art" viewBox="0 0 420 320">
                <circle cx="250" cy="150" fill="none" r="96" stroke="currentColor" strokeOpacity="0.16" strokeWidth="2" />
                <circle cx="250" cy="150" fill="none" r="146" stroke="currentColor" strokeOpacity="0.11" strokeWidth="2" />
                <circle cx="250" cy="150" fill="none" r="198" stroke="currentColor" strokeOpacity="0.07" strokeWidth="2" />
                <circle className="sun" cx="250" cy="150" fill="#f2a541" r="34" />
              </svg>
              <div className="relative">
                {topRow}
                {hero}
              </div>
            </div>
          ) : (
            topRow
          );
        })()}
        {isTeammate ? null : <TrialBanner />}
        {children}
        {isTeammate ? null : <TrialBanner placement="inline" />}
      </main>

      <nav className="fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-3 right-3 z-30 rounded-[24px] border border-[var(--border)] bg-white shadow-[var(--shadow-float)] lg:hidden">
        {/* On phones the + lives in the menu bar: floating over the page it sat on top of the buttons at the end of each row. */}
        <div className={`grid px-1 py-2 ${onFocusedFlow ? "grid-cols-4" : "grid-cols-5"}`}>
          {mobileBarItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <Fragment key={item.key}>
              {index === 2 && !onFocusedFlow ? (
                <button aria-label={t("openFastActions")} className="flex items-center justify-center" onClick={() => setFastActionOpen(true)} type="button">
                  {/* Centred in the bar: its middle sits level with the middle of each icon-and-label pair. */}
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]">
                    <Plus size={26} />
                  </span>
                </button>
              ) : null}
              <Link
                className={`phone-bar-item flex min-w-0 flex-col items-center gap-1 rounded-md px-1 py-2 font-bold ${
                  isActive(item.href) ? "text-[var(--primary)]" : "text-[var(--muted)]"
                }`}
                href={item.href}
                key={item.key}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={isActive(item.href) ? 2.4 : 2} />
                  {badgeFor(item.key) > 0 ? (
                    <span className="phone-bar-badge absolute -right-3 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--danger)] px-1 font-bold text-white">{badgeFor(item.key)}</span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{t(item.key)}</span>
              </Link>
              </Fragment>
            );
          })}
          <button
            aria-expanded={moreOpen}
            className={`phone-bar-item flex min-w-0 flex-col items-center gap-1 rounded-md px-1 py-2 font-bold ${
              moreActive || moreOpen ? "text-[var(--primary)]" : "text-[var(--muted)]"
            }`}
            onClick={() => setMoreOpen(true)}
            type="button"
          >
            <span className="relative">
              <MoreHorizontal size={18} />
              {shell.dueTasks > 0 && !mobileBarKeys.includes("tasks") ? (
                <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-semibold text-white">{shell.dueTasks}</span>
              ) : null}
            </span>
            {/* Same size as the other labels: buttons otherwise take the page's larger default. */}
            <span className="max-w-full truncate text-[11px] leading-[16.5px]">{t("more")}</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[var(--foreground)]/50 lg:hidden" onClick={() => setMoreOpen(false)}>
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
                    <span className="relative">
                      <Icon size={18} />
                      {badgeFor(item.key) > 0 ? (
                        <span className="absolute -right-3 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-semibold text-white">{badgeFor(item.key)}</span>
                      ) : null}
                    </span>
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

      <FastActionSheet open={fastActionOpen} onClose={() => setFastActionOpen(false)} />
    </div>
  );
}
