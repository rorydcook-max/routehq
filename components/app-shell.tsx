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
  LogOut,
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
import { Toaster } from "@/components/toast";
import { AskBox } from "@/components/ask-box";
import { RouteHqLogo } from "@/components/brand-logo";
import { BrandStyle } from "@/components/brand-style";
import { BusinessLogoImage } from "@/components/business-logo-image";
import { useInitialShellBrand } from "@/components/shell-brand-provider";
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

// The side menu in groups, in the order the day goes: today's work, the rentals, the money, then the tools
// used now and then. Settings and Help sit at the foot. A group heading is a word, not a link.
type NavGroup = { heading: "g_rentals" | "g_money" | "g_tools" | null; items: NavItem[] };
const navGroups: NavGroup[] = [
  {
    heading: null,
    items: [
      { key: "dashboard", href: "/", icon: Home },
      { key: "tasks", href: "/tasks", icon: ListChecks },
      { key: "inbox", href: "/inbox", icon: MessagesSquare }
    ]
  },
  {
    heading: "g_rentals",
    items: [
      { key: "bookings", href: "/bookings", icon: ClipboardList },
      { key: "calendar", href: "/calendar", icon: CalendarDays },
      { key: "fleet", href: "/fleet", icon: Car },
      { key: "customers", href: "/customers", icon: Users }
    ]
  },
  {
    heading: "g_money",
    items: [
      { key: "transactions", href: "/transactions", icon: ReceiptText },
      { key: "reports", href: "/reports", icon: BarChart3 }
    ]
  },
  {
    heading: "g_tools",
    items: [
      { key: "documents", href: "/documents", icon: FileText },
      { key: "partners", href: "/partners" as Route, icon: Handshake },
      { key: "rentalCalculator", href: "/rental-calculator", icon: Calculator }
    ]
  }
];
const footItems: NavItem[] = [
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
  // The brand arrives with the page from the root layout, so their logo is on the first frame: no RouteHQ flash.
  const initialBrand = useInitialShellBrand();
  const [shell, setShell] = useState<ShellContext>({ role: null, organizations: [], unreadChats: 0, dueTasks: 0, helpReplies: 0, brand: initialBrand });
  useEffect(() => {
    let cancelled = false;
    getShellContext()
      .then((context) => {
        if (cancelled) return;
        // A failed logo lookup in the refresh must not swap their brand for RouteHQ's: keep the first-frame brand.
        setShell({ ...context, brand: context.brand ?? initialBrand });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const brand = shell.brand;
  // Their name in text if the logo file is missing or slow: never an empty box where the brand should be.
  const brandName = brand?.name ? <span className="truncate text-[1.1rem] font-black leading-none tracking-[-0.02em] text-[var(--foreground)]">{brand.name}</span> : null;
  const brandLogo = brand ? (
    <span className="flex min-w-0 flex-col">
      <BusinessLogoImage alt={brand.name} className="max-h-12 max-w-[190px] object-contain object-left" fallback={brandName} src={brand.logoUrl} />
      {brand.poweredBy ? <span className="mt-0.5 text-[10px] font-semibold text-[var(--sidebar-text-muted)]">Powered by RouteHQ</span> : null}
    </span>
  ) : null;
  const isTeammate = shell.role === "teammate" || shell.role === "manager";
  const hasSeveralBusinesses = shell.organizations.length > 1;
  const activeBusiness = shell.organizations.find((organization) => organization.active);
  const ownerOnly = ["/settings", "/reports", "/rental-calculator"];
  const allowed = (item: NavItem) => !isTeammate || !ownerOnly.includes(item.href);
  const groups = navGroups.map((group) => ({ ...group, items: group.items.filter(allowed) })).filter((group) => group.items.length > 0);
  const visibleFootItems = footItems.filter(allowed);
  const allNavItems = [...groups.flatMap((group) => group.items), ...visibleFootItems];
  const mobileBarItems = mobileBarKeys.map((key) => allNavItems.find((item) => item.key === key)).filter(Boolean) as NavItem[];
  const moreItems = allNavItems.filter((item) => !mobileBarKeys.includes(item.key)).sort((a, b) => Number(b.key === "bookings") - Number(a.key === "bookings"));

  const onFocusedFlow = !!pathname && (pathname.startsWith("/inspections") || /\/(new|edit|import)(\/|$)/.test(pathname));
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const moreActive = moreItems.some((item) => isActive(item.href));
  const badgeFor = (key: NavKey) => (key === "inbox" ? shell.unreadChats : key === "tasks" ? shell.dueTasks : key === "help" ? shell.helpReplies : 0);

  const sideLink = (item: NavItem, compact = false) => {
    const Icon = item.icon;
    return (
      <Link
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition [@media(max-height:960px)]:py-1.5 ${compact ? "min-w-0 flex-1 justify-center gap-1.5 whitespace-nowrap px-2" : "w-full"} ${
          isActive(item.href) ? "bg-[var(--primary-light)] text-[var(--primary)]" : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]"
        }`}
        href={item.href}
        key={item.key}
      >
        <Icon className="shrink-0" size={16} />
        {t(item.key)}
        {badgeFor(item.key) > 0 ? (
          <span className="ml-auto flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-[14px] font-bold leading-none text-white">{badgeFor(item.key)}</span>
        ) : null}
      </Link>
    );
  };

  return (
    <div className={`min-h-screen lg:pb-0 ${onFocusedFlow ? "focused-flow pb-24" : "pb-28"}`}>
      <BrandStyle colour={brand?.colour} />
      <aside className="app-sidebar fixed left-0 top-0 z-20 hidden h-screen w-[220px] flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-3 py-4 lg:flex">
        <div className="mb-3 flex items-center px-2 pt-1">
          {brandLogo || <RouteHqLogo />}
        </div>
        {hasSeveralBusinesses ? (
          <form action={switchActiveOrganization} className="mb-3">
            <select
              aria-label={t("business")}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-2.5 py-2 text-sm font-bold text-[var(--foreground)]"
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
        {/* Quick add sits in the side menu on computers: floating over the page it covered the buttons at the end of each row. */}
        <div className="mb-3 flex items-center gap-2">
          {!isTeammate ? (
            <div className="min-w-0 flex-1">
              <AskBox variant="sidebar" />
            </div>
          ) : null}
          {onFocusedFlow ? null : (
            <button
              aria-label={t("quickAdd")}
              className={`flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--primary)] text-sm font-bold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--primary-hover)] ${isTeammate ? "w-full px-3" : "w-10 shrink-0"}`}
              data-tip={isTeammate ? undefined : t("quickAdd")}
              onClick={() => setFastActionOpen(true)}
              type="button"
            >
              <Plus size={isTeammate ? 16 : 20} />
              {isTeammate ? t("quickAdd") : null}
            </button>
          )}
        </div>
        {/* On a short laptop screen the rows tighten so every link, Settings included, stays in view without scrolling. */}
        <nav className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
          {groups.map((group, groupIndex) => (
            <div className={groupIndex ? "mt-3 [@media(max-height:960px)]:mt-1.5" : ""} key={group.heading || "today"}>
              {group.heading ? <p className="px-3 pb-0.5 text-[14px] font-bold text-[var(--sidebar-text-muted)]">{t(group.heading)}</p> : null}
              <div className="space-y-0.5">{group.items.map((item) => sideLink(item))}</div>
            </div>
          ))}
        </nav>
        <div className="mt-2 flex gap-1 border-t border-[var(--sidebar-border)] pt-2">
          {visibleFootItems.map((item) => sideLink(item, true))}
        </div>
        {isTeammate ? null : (
          <div className="[@media(max-height:960px)]:hidden">
            <TrialBanner placement="sidebar" />
          </div>
        )}
        {userEmail ? (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-white p-1.5 pl-2 shadow-[var(--shadow-sm)]">
            <Link className="flex min-w-0 flex-1 items-center gap-2 rounded-lg hover:text-[var(--primary)]" href="/account" title={t("myAccount")}>
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-[14px] font-bold uppercase text-[var(--primary)]">{userEmail.slice(0, 1)}</span>
              <span className="min-w-0 truncate text-sm font-semibold text-[var(--foreground-secondary)]">{userEmail}</span>
            </Link>
            <form action={signOut}>
              <PendingButton aria-label={t("signOut")} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]" pendingLabel="" title={t("signOut")} type="submit">
                <LogOut size={16} />
              </PendingButton>
            </form>
          </div>
        ) : null}
      </aside>

      <main className="content-area mx-auto lg:ml-[220px] lg:max-w-none">
        {(() => {
          const topRow = userEmail ? (
          // Phones: logo and (for people in several businesses) the switcher.
          // Account and sign-out live under More, away from thumbs.
          <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
            <Link aria-label={brand?.name || "RouteHQ dashboard"} className="min-w-0" href="/">
              {brand ? (
                // On the coloured band the logo sits on a white tab; if the file is missing, their name goes there instead.
                <span className={`flex h-8 max-w-[160px] items-center ${hero ? "rounded-md bg-white px-1.5" : ""}`}>
                  <BusinessLogoImage
                    alt={brand.name}
                    className="h-7 max-w-[140px] object-contain object-left"
                    fallback={<span className="truncate text-[15px] font-black leading-none text-[var(--foreground)]">{brand.name}</span>}
                    src={brand.logoUrl}
                  />
                </span>
              ) : (
                <RouteHqLogo className="h-7 w-auto" showDescriptor={false} tone={hero ? "dark" : "light"} />
              )}
            </Link>
            <span className="ml-auto">{!isTeammate ? <AskBox variant="icon" /> : null}</span>
            {hasSeveralBusinesses ? (
              <form action={switchActiveOrganization}>
                <select
                  aria-label={t("business")}
                  className="max-w-[150px] truncate rounded-full border border-[var(--border)] bg-white px-2 py-1.5 text-sm font-semibold text-[var(--foreground-secondary)] shadow-sm"
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

      <nav className={`fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-3 right-3 z-30 rounded-[24px] border border-[var(--border)] bg-white shadow-[var(--shadow-float)] lg:hidden ${onFocusedFlow ? "hidden" : ""}`}>
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
                <span className="max-w-full truncate">{item.key === "dashboard" ? t("home") : t(item.key)}</span>
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
              <MoreHorizontal size={22} />
              {shell.dueTasks > 0 && !mobileBarKeys.includes("tasks") ? (
                <span className="phone-bar-badge absolute -right-3 -top-1.5 flex items-center justify-center rounded-full bg-[var(--primary)] px-1 font-bold text-white">{shell.dueTasks}</span>
              ) : null}
            </span>
            {/* Same size as the other labels: buttons otherwise take the page's larger default. */}
            <span className="max-w-full truncate">{t("more")}</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[var(--foreground)]/50 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div
            className="w-full rounded-t-2xl bg-white p-4 pb-8 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[18px] font-bold text-[var(--foreground)]">{t("more")}</p>
              <button aria-label={t("close")} className="rounded-lg p-1.5 text-[var(--sidebar-text)]" onClick={() => setMoreOpen(false)} type="button">
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto">
              {[
                ...groups.map((group) => ({ heading: group.heading, items: group.items.filter((item) => !mobileBarKeys.includes(item.key)) })),
                { heading: null, items: visibleFootItems }
              ]
                .filter((group) => group.items.length > 0)
                .map((group, groupIndex) => (
                  <div key={group.heading || `plain-${groupIndex}`}>
                    {group.heading ? <p className="mb-1.5 font-bold text-[var(--muted)]">{t(group.heading)}</p> : null}
                    <div className="grid grid-cols-3 gap-2">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            className={`flex flex-col items-center gap-1.5 rounded-xl px-1.5 py-3 text-center text-[14px] font-bold leading-tight ${
                              isActive(item.href) ? "bg-[var(--primary-light)] text-[var(--primary)]" : "bg-[var(--panel-secondary)] text-[var(--foreground)]"
                            }`}
                            href={item.href}
                            key={item.key}
                            onClick={() => setMoreOpen(false)}
                          >
                            <span className="relative">
                              <Icon size={20} />
                              {badgeFor(item.key) > 0 ? (
                                <span className="absolute -right-3.5 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[14px] font-bold leading-none text-white">{badgeFor(item.key)}</span>
                              ) : null}
                            </span>
                            <span>{t(item.key)}</span>
                          </Link>
                        );
                      })}
                      {group.heading === null && groupIndex > 0 ? (
                        <Link
                          className="flex flex-col items-center gap-1.5 rounded-xl bg-[var(--panel-secondary)] px-1.5 py-3 text-center text-[14px] font-bold leading-tight text-[var(--foreground)]"
                          href="/account"
                          onClick={() => setMoreOpen(false)}
                        >
                          <CircleUserRound size={20} />
                          <span>{t("myAccount")}</span>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
            {userEmail ? (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                <span className="min-w-0 truncate text-[14px] font-semibold text-[var(--muted)]">{userEmail}</span>
                <form action={signOut}>
                  <PendingButton className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-[var(--border)] bg-white px-4 py-2 text-[14px] font-bold text-[var(--foreground)]" pendingLabel="" type="submit">
                    {t("signOut")}
                  </PendingButton>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <FastActionSheet open={fastActionOpen} onClose={() => setFastActionOpen(false)} />
      <Toaster />
    </div>
  );
}
