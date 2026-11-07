import Link from "next/link";
import type { Route } from "next";
import { countUnreadForTeam } from "@/lib/helpdesk";

/** Tabs across the top of the RoveHQ admin console. */
const TABS = [
  { href: "/platform", label: "Overview" },
  { href: "/platform/support", label: "Support" },
  { href: "/platform/businesses", label: "Businesses" },
  { href: "/platform/setup", label: "Set it up for me" },
  { href: "/platform/users", label: "Users" },
  { href: "/platform/catalog", label: "Vehicle catalog" },
  { href: "/platform/log", label: "Admin log" },
  { href: "/platform/renters", label: "Renters" },
  { href: "/platform/messages", label: "Messages" },
  { href: "/platform/leads", label: "Leads" }
];

/** The unread number on the Support tab, so a waiting customer is visible from every admin page. Never breaks the nav. */
async function SupportUnread({ active }: { active: boolean }) {
  const unread = await countUnreadForTeam().catch(() => 0);
  if (!unread) return null;
  return (
    <span aria-label={`${unread} unread`} className={`num ml-1.5 rounded-full px-1.5 text-[12px] ${active ? "bg-white/25 text-white" : "bg-[var(--primary)] text-white"}`}>
      {unread}
    </span>
  );
}

export function AdminHeader({ active, title, subtitle }: { active: string; title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--primary)]">RoveHQ admin</p>
      <h1 className="page-title mt-1">{title}</h1>
      {subtitle ? <p className="measure mt-1.5 font-medium text-[var(--foreground-secondary)]">{subtitle}</p> : null}
      <nav aria-label="Admin sections" className="chip-row mt-5 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            aria-current={tab.href === active ? "page" : undefined}
            className={`pressable inline-flex min-h-10 items-center rounded-full px-4 text-[14px] font-bold ${tab.href === active ? "bg-[var(--primary)] text-white" : "bg-white text-[var(--foreground-secondary)] shadow-[0_0_0_1px_var(--border)] hover:text-[var(--foreground)]"}`}
            href={tab.href as Route}
            key={tab.href}
          >
            {tab.label}
            {tab.href === "/platform/support" ? <SupportUnread active={tab.href === active} /> : null}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    active: "bg-[var(--success-light)] text-[var(--success)]",
    trial: "bg-[var(--info-light)] text-[var(--info)]",
    past_due: "bg-[var(--warning-light)] text-[var(--warning)]",
    expired: "bg-[var(--panel-tertiary)] text-[var(--muted)]",
    cancelled: "bg-[var(--danger-light)] text-[var(--danger)]"
  };
  const label: Record<string, string> = { trial: "Free trial", active: "Paying", past_due: "Payment late", expired: "Trial ended", cancelled: "Canceled" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-bold ${tone[status] || tone.expired}`}>{label[status] || status}</span>;
}
