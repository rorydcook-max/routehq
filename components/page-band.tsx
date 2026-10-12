import Link from "next/link";
import type { Route } from "next";

/**
 * What goes inside the teal band a main page opens with (Lagoon look): the page's
 * name, a line on what it is for, and its one main action in mango. Pass it to
 * AppShell as `hero`. Pages with numbers worth a glance build their own band.
 */
export function PageBand({
  title,
  subtitle,
  action,
  keepSubtitle = false,
  children
}: {
  title: string;
  subtitle?: string | null;
  keepSubtitle?: boolean;
  action?: { href: string; label: string; icon?: React.ReactNode } | null;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[30px] font-bold leading-tight text-white">{title}</h1>
          {/* Phones keep the band short: the line under the name shows from tablet width, unless the page needs it. */}
          {subtitle ? <p className={`mt-1 font-medium text-white/85 ${keepSubtitle ? "" : "hidden sm:block"}`}>{subtitle}</p> : null}
        </div>
        {action ? (
          <Link className="pressable inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full bg-[var(--band-action)] px-4 font-bold text-[var(--band-action-ink)]" href={action.href as Route}>
            {action.icon}
            {action.label}
          </Link>
        ) : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

/** A tab or filter that sits on the band: white when chosen, see-through otherwise. */
export function bandTab(active: boolean) {
  return `pressable inline-flex min-h-10 items-center rounded-full px-4 font-bold ${active ? "bg-white text-[var(--foreground)]" : "bg-[var(--band-soft)] text-white"}`;
}
