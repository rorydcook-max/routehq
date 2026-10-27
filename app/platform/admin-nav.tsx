import Link from "next/link";
import type { Route } from "next";

/** Tabs across the top of the RouteHQ admin console. */
const TABS = [
  { href: "/platform", label: "Overview" },
  { href: "/platform/businesses", label: "Businesses" },
  { href: "/platform/log", label: "Admin log" },
  { href: "/platform/renters", label: "Renters" },
  { href: "/help/team", label: "Help queue" }
];

export function AdminHeader({ active, title, subtitle }: { active: string; title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--primary)]">RouteHQ admin</p>
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
  const label: Record<string, string> = { trial: "Free trial", active: "Paying", past_due: "Payment late", expired: "Trial ended", cancelled: "Cancelled" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-bold ${tone[status] || tone.expired}`}>{label[status] || status}</span>;
}
