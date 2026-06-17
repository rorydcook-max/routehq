import { CalendarClock, Car, CheckCircle2, Clock } from "lucide-react";

type AgendaItem = {
  type: "start" | "end" | "reminder";
  label: string;
  sub: string;
};

export function TodayCalendarCard({ items, dateLabel, className = "" }: { items: AgendaItem[]; dateLabel: string; className?: string }) {
  return (
    <div className={`kpi-card flex flex-col ${className}`}>
      <div className="flex items-center gap-2">
        <CalendarClock size={14} className="shrink-0 text-[var(--primary)]" />
        <p className="text-xs font-semibold text-[var(--muted)]">What's on today</p>
      </div>
      <p className="mt-0.5 text-xs font-black text-[var(--foreground)]">{dateLabel}</p>

      {items.length === 0 ? (
        <p className="mt-3 flex-1 text-xs text-[var(--muted)]">Nothing scheduled — clear day.</p>
      ) : (
        <ul className="mt-2 flex-1 space-y-1.5">
          {items.map((item, i) => (
            <li className="flex items-start gap-2" key={i}>
              <span className="mt-0.5 shrink-0">
                {item.type === "start" ? (
                  <Car size={12} className="text-[var(--primary)]" />
                ) : item.type === "end" ? (
                  <CheckCircle2 size={12} className="text-amber-500" />
                ) : (
                  <Clock size={12} className="text-[#667085]" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold leading-4 text-[var(--foreground)]">{item.label}</span>
                {item.sub ? <span className="block truncate text-[10px] text-[var(--muted)]">{item.sub}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
