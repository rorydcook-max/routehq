"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveBookingRules } from "@/app/actions/online-booking";
import { END_NOTICE_OPTIONS, EXTEND_NOTICE_OPTIONS, GAP_DAY_OPTIONS, HOLD_HOUR_OPTIONS, LEAD_HOUR_OPTIONS, type BookingRules } from "@/lib/booking-rules";

const days = (value: number, none: string) => (value === 0 ? none : value === 1 ? "1 day" : `${value} days`);
const hours = (value: number, none: string) => (value === 0 ? none : value % 24 === 0 && value >= 24 ? days(value / 24, none) : `${value} hours`);

/** Holds and notice periods: set once, applied to every booking. Saves on change. */
export function BookingRulesPanel({ rules }: { rules: BookingRules }) {
  const router = useRouter();
  const [values, setValues] = useState(rules);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function change(key: keyof BookingRules, value: number) {
    const next = { ...values, [key]: value };
    setValues(next);
    setMessage(null);
    startTransition(async () => {
      const result = await saveBookingRules(next).catch(() => ({ ok: false as const, error: "Couldn't save. Please try again." }));
      if (!result.ok) {
        setMessage(result.error);
        setValues(rules);
        return;
      }
      router.refresh();
    });
  }

  const rows: Array<{ key: keyof BookingRules; label: string; help: string; options: number[]; text: (value: number) => string }> = [
    {
      key: "holdHours",
      label: "Hold a vehicle for an unsigned booking for",
      help: "A new booking link reserves the vehicle for this long. Once the customer signs it is booked. If they don't, the dates open up again and their link still works if the vehicle is free.",
      options: HOLD_HOUR_OPTIONS,
      text: (value) => `${value} hours`
    },
    {
      key: "leadHours",
      label: "Notice needed for an online booking",
      help: "Customers booking from your booking page can't start sooner than this.",
      options: LEAD_HOUR_OPTIONS,
      text: (value) => hours(value, "None, same day is fine")
    },
    {
      key: "gapDays",
      label: "Keep free after each rental",
      help: "Time for cleaning and checks. Online bookings and automatic extensions leave this gap; you can still book into it yourself.",
      options: GAP_DAY_OPTIONS,
      text: (value) => days(value, "No gap")
    },
    {
      key: "endNoticeDays",
      label: "Notice a customer gives before returning",
      help: "On an open-ended rental, the earliest return date a customer can choose from their booking page.",
      options: END_NOTICE_OPTIONS,
      text: (value) => days(value, "None")
    },
    {
      key: "extendNoticeDays",
      label: "Notice needed to extend automatically",
      help: "An extension asked for at least this far ahead is applied by itself when the vehicle is free. Later requests come to you.",
      options: EXTEND_NOTICE_OPTIONS,
      text: (value) => days(value, "None, any time before the end")
    }
  ];

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {rows.map((row) => (
        <label className="block text-xs font-semibold text-[var(--foreground-secondary)]" key={row.key}>
          {row.label}
          <select
            className="mt-1 block h-10 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm"
            disabled={isPending}
            onChange={(event) => change(row.key, Number(event.target.value))}
            value={values[row.key]}
          >
            {row.options.map((option) => (
              <option key={option} value={option}>{row.text(option)}</option>
            ))}
          </select>
          <span className="mt-1 block font-normal leading-5 text-[var(--muted)]">{row.help}</span>
        </label>
      ))}
      {message ? <p className="text-xs font-semibold text-[var(--danger)] sm:col-span-2">{message}</p> : null}
    </div>
  );
}
