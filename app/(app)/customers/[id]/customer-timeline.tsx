"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { longDate } from "@/lib/i18n/dates";

/** One line of a customer's timeline, already worded on the server. */
export type TimelineRow = {
  id: string;
  day: string;
  kind: "contact" | "booking" | "money" | "paper" | "damage" | "change";
  title: string;
  detail?: string | null;
  amount?: string | null;
  /** Money out (a refund) shows in red. */
  out?: boolean;
  href?: string | null;
};

type Say = (key: string, values?: Record<string, string | number>) => string;

const KIND_COLOUR: Record<TimelineRow["kind"], string> = {
  contact: "var(--primary)",
  booking: "var(--coming-back)",
  money: "var(--success)",
  paper: "var(--going-out)",
  damage: "var(--danger)",
  change: "var(--warning)"
};

const FILTERS = ["all", "booking", "money", "paper"] as const;
type Filter = (typeof FILTERS)[number];
const PAGE = 20;

/** A customer's life with the business, newest first, grouped by day. */
export function CustomerTimeline({ rows }: { rows: TimelineRow[] }) {
  const say = useTranslations("customerPage") as unknown as Say;
  const locale = useLocale();
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);

  const visible = useMemo(
    () => rows.filter((row) => filter === "all" || row.kind === filter || (filter === "booking" && (row.kind === "change" || row.kind === "damage"))),
    [rows, filter]
  );
  const days = useMemo(() => {
    const groups: Array<{ day: string; rows: TimelineRow[] }> = [];
    for (const row of visible.slice(0, shown)) {
      const last = groups[groups.length - 1];
      if (last && last.day === row.day) last.rows.push(row);
      else groups.push({ day: row.day, rows: [row] });
    }
    return groups;
  }, [visible, shown]);

  const label: Record<Filter, string> = { all: say("tl_fAll"), booking: say("tl_fBookings"), money: say("tl_fMoney"), paper: say("tl_fPaper") };

  return (
    <div className="grid gap-3">
      <div className="chip-row flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <button
            aria-pressed={filter === entry}
            className={`min-h-10 rounded-full px-4 font-bold ${filter === entry ? "bg-[var(--primary)] text-white" : "bg-[var(--panel-secondary)] text-[var(--foreground)]"}`}
            key={entry}
            onClick={() => {
              setFilter(entry);
              setShown(PAGE);
            }}
            type="button"
          >
            {label[entry]}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="py-3 font-medium text-[var(--foreground-secondary)]">{say("tl_empty")}</p>
      ) : (
        <div className="grid gap-4">
          {days.map((group) => (
            <section key={group.day}>
              <h3 className="mb-2 font-bold text-[var(--muted)]">
                <time dateTime={group.day}>{longDate(group.day, locale)}</time>
              </h3>
              <ol className="relative ml-[7px] border-l-2 border-[var(--border)] pl-5">
                {group.rows.map((row) => {
                  const body = (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[16px] font-bold leading-tight text-[var(--foreground)]">{row.title}</p>
                        {row.detail ? <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{row.detail}</p> : null}
                      </div>
                      {row.amount ? <span className={`num shrink-0 text-[16px] ${row.out ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>{row.amount}</span> : null}
                    </div>
                  );
                  return (
                    <li className="relative pb-3 last:pb-0" key={row.id}>
                      <span aria-hidden="true" className="absolute -left-[28px] top-[5px] h-3.5 w-3.5 rounded-full shadow-[0_0_0_3px_#fff]" style={{ background: KIND_COLOUR[row.kind] }} />
                      {row.href ? (
                        <Link className="block rounded-lg hover:bg-[var(--panel-secondary)]" href={row.href as Route}>
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
      {visible.length > shown ? (
        <button className="secondary-action pressable w-fit" onClick={() => setShown((count) => count + PAGE)} type="button">
          {say("tl_more", { count: Math.min(PAGE, visible.length - shown) })}
        </button>
      ) : null}
    </div>
  );
}
