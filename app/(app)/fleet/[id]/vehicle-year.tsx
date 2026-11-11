import Link from "next/link";
import type { Route } from "next";

export type YearRental = { id: string; start: string; end: string | null; name: string; upcoming: boolean };
export type YearMark = { id: string; date: string; kind: "service" | "paper" | "check"; label: string };

const MARK_COLOUR: Record<YearMark["kind"], string> = {
  service: "var(--foreground)",
  paper: "var(--warning)",
  check: "var(--primary)"
};

/**
 * The vehicle's year as a picture (Rory, 1 Nov 2026): twelve months across, from nine months back to three ahead.
 * One line shows when it was out on rent and with whom; the other shows services and repairs, checks, and
 * paperwork running out. A line marks today. Each rental bar opens its booking.
 */
export function VehicleYear({
  rentals,
  marks,
  today,
  locale,
  labels
}: {
  rentals: YearRental[];
  marks: YearMark[];
  today: string;
  locale: string;
  labels: { rentals: string; upkeep: string; today: string; service: string; paper: string; check: string; nothing: string };
}) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  const start = Date.UTC(year, month - 8, 1);
  const end = Date.UTC(year, month + 4, 1);
  const span = end - start;
  const at = (iso: string) => Math.min(100, Math.max(0, ((Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - start) / span) * 100));
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 8 + index, 1));
    let label = date.toLocaleString(locale, { month: "short", timeZone: "UTC" });
    try {
      label = new Intl.DateTimeFormat(locale, { month: "narrow", timeZone: "UTC" }).format(date);
      if (label.length < 2) label = date.toLocaleString(locale, { month: "short", timeZone: "UTC" });
    } catch {
      // Keep the short name.
    }
    return { key: date.toISOString().slice(0, 7), label, isNow: index === 8 };
  });
  const startIso = new Date(start).toISOString().slice(0, 10);
  const endIso = new Date(end - 86_400_000).toISOString().slice(0, 10);
  const bars = rentals
    .filter((rental) => rental.start <= endIso && (!rental.end || rental.end >= startIso))
    .map((rental) => {
      const left = at(rental.start);
      const right = rental.end ? at(rental.end) : 100;
      return { ...rental, left, width: Math.max(1.2, right - left) };
    });
  const dots = marks.filter((mark) => mark.date >= startIso && mark.date <= endIso);
  const todayAt = at(today);

  return (
    <div>
      <div className="relative">
        {/* Today, through both lines. */}
        <span aria-hidden="true" className="absolute bottom-0 top-0 z-10 w-0.5 rounded-full bg-[var(--danger)]" style={{ left: `${todayAt}%` }} />
        <p className="mb-1 text-sm font-semibold text-[var(--foreground-secondary)]">{labels.rentals}</p>
        <div className="relative h-9 rounded-lg bg-[var(--panel-secondary)]">
          {bars.length === 0 ? <span className="absolute inset-0 flex items-center px-3 text-sm text-[var(--muted)]">{labels.nothing}</span> : null}
          {bars.map((bar) => (
            <Link
              className="absolute top-1 flex h-7 items-center overflow-hidden rounded-md px-1.5 text-xs font-bold text-white"
              href={`/bookings/${bar.id}` as Route}
              key={`${bar.id}-${bar.start}`}
              style={{ left: `${bar.left}%`, width: `${bar.width}%`, background: bar.upcoming ? "var(--going-out)" : "var(--on-rent)" }}
              title={bar.name}
            >
              <span className="truncate">{bar.width > 9 ? bar.name : ""}</span>
            </Link>
          ))}
        </div>
        <p className="mb-1 mt-3 text-sm font-semibold text-[var(--foreground-secondary)]">{labels.upkeep}</p>
        <div className="relative h-7 rounded-lg bg-[var(--panel-secondary)]">
          {dots.map((dot) => (
            <span
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
              key={dot.id}
              style={{ left: `${at(dot.date)}%`, background: MARK_COLOUR[dot.kind] }}
              title={dot.label}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 grid grid-cols-12 text-center text-xs font-semibold text-[var(--muted)]">
        {months.map((entry) => (
          <span className={entry.isNow ? "text-[var(--foreground)]" : ""} key={entry.key}>
            {entry.label}
          </span>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-[var(--foreground-secondary)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: "var(--on-rent)" }} />{labels.rentals}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: MARK_COLOUR.service }} />{labels.service}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: MARK_COLOUR.check }} />{labels.check}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: MARK_COLOUR.paper }} />{labels.paper}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 rounded-full bg-[var(--danger)]" />{labels.today}</span>
      </p>
    </div>
  );
}
