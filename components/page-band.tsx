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
          <h1 className="text-[32px] leading-tight text-white">{title}</h1>
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

/**
 * Counts on the band, as pills (Look G): a number in the display face, a few words, and a dot when
 * the count has a colour meaning. One that needs doing something about turns white with a brick number.
 */
export function BandPills({ items }: { items: Array<{ count: number; label: string; dot?: string | null; alert?: boolean }> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const loud = !!item.alert && item.count > 0;
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 ${loud ? "bg-white text-[var(--foreground)]" : "bg-[var(--band-soft)] text-white"}`} key={item.label}>
            {item.dot ? <span aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: item.dot }} /> : null}
            <span className={`num text-[22px] leading-none ${loud ? "text-[var(--danger)]" : ""}`}>{item.count}</span>
            <span className="font-semibold">{item.label}</span>
          </span>
        );
      })}
    </div>
  );
}
