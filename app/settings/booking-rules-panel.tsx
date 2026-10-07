"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveBookingRules } from "@/app/actions/online-booking";
import { END_NOTICE_OPTIONS, EXTEND_NOTICE_OPTIONS, GAP_DAY_OPTIONS, HOLD_HOUR_OPTIONS, LEAD_HOUR_OPTIONS, type BookingRules } from "@/lib/booking-rules";

type Say = (key: string, values?: Record<string, string | number>) => string;

/** Holds and notice periods: set once, applied to every booking. Saves on change. */
export function BookingRulesPanel({ rules }: { rules: BookingRules }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const router = useRouter();
  const [values, setValues] = useState(rules);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const days = (value: number, none: string) => (value === 0 ? none : say("ru_days", { count: value }));
  const hours = (value: number, none: string) => (value === 0 ? none : value % 24 === 0 && value >= 24 ? days(value / 24, none) : say("ru_hours", { count: value }));

  function change(key: keyof BookingRules, value: number) {
    const next = { ...values, [key]: value };
    setValues(next);
    setFailed(false);
    startTransition(async () => {
      const result = await saveBookingRules(next).catch(() => ({ ok: false as const }));
      if (!result.ok) {
        setFailed(true);
        setValues(rules);
        return;
      }
      router.refresh();
    });
  }

  const rows: Array<{ key: keyof BookingRules; label: string; help: string; options: number[]; text: (value: number) => string }> = [
    { key: "holdHours", label: say("ru_hold"), help: say("ru_holdHelp"), options: HOLD_HOUR_OPTIONS, text: (value) => say("ru_hours", { count: value }) },
    { key: "leadHours", label: say("ru_lead"), help: say("ru_leadHelp"), options: LEAD_HOUR_OPTIONS, text: (value) => hours(value, say("ru_leadNone")) },
    { key: "gapDays", label: say("ru_gap"), help: say("ru_gapHelp"), options: GAP_DAY_OPTIONS, text: (value) => days(value, say("ru_gapNone")) },
    { key: "endNoticeDays", label: say("ru_end"), help: say("ru_endHelp"), options: END_NOTICE_OPTIONS, text: (value) => days(value, say("ru_none")) },
    { key: "extendNoticeDays", label: say("ru_extend"), help: say("ru_extendHelp"), options: EXTEND_NOTICE_OPTIONS, text: (value) => days(value, say("ru_extendNone")) }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map((row) => (
        <label className="block" key={row.key}>
          <span className="font-semibold text-[var(--foreground)]">{row.label}</span>
          <select className="mt-1 block w-full" disabled={isPending} onChange={(event) => change(row.key, Number(event.target.value))} value={values[row.key]}>
            {row.options.map((option) => (
              <option key={option} value={option}>
                {row.text(option)}
              </option>
            ))}
          </select>
          <span className="mt-1 block font-medium text-[var(--muted)]">{row.help}</span>
        </label>
      ))}
      {failed ? <p className="font-bold text-[var(--danger)] sm:col-span-2">{say("saveFailed")}</p> : null}
    </div>
  );
}
