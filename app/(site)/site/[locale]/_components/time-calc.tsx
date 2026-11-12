"use client";

import { useState, type ReactNode } from "react";
import h from "../home.module.css";

type Words = { title: string; lede: string; bookings: string; minutes: string; hours: string; days: string; note: string };

/**
 * "How much of your month is paperwork?" (home page, 12 Nov 2026). The visitor moves two sliders with their own
 * numbers and sees the hours that adds up to. It is plain arithmetic on what they enter: no claim of ours in it.
 */
export function TimeCalc({ words, action }: { words: Words; action: ReactNode }) {
  const [bookings, setBookings] = useState(40);
  const [minutes, setMinutes] = useState(25);
  const hours = Math.round((bookings * minutes) / 60);
  const days = Math.round((hours * 12) / 8);
  return (
    <div className={h.calc}>
      <div className={h.calcText}>
        <h2 className={h.calcTitle}>{words.title}</h2>
        <p className={h.calcLede}>{words.lede}</p>
        <label className={h.calcField}>
          <span>
            {words.bookings} <output>{bookings}</output>
          </span>
          <input max={300} min={5} onChange={(event) => setBookings(Number(event.target.value))} step={5} type="range" value={bookings} />
        </label>
        <label className={h.calcField}>
          <span>
            {words.minutes} <output>{minutes}</output>
          </span>
          <input max={60} min={5} onChange={(event) => setMinutes(Number(event.target.value))} step={5} type="range" value={minutes} />
        </label>
      </div>
      <div aria-live="polite" className={h.calcResult}>
        <p className={h.calcBig}>{hours}</p>
        <p className={h.calcUnit}>{words.hours}</p>
        <p className={h.calcYear}>
          <strong>{days}</strong> {words.days}
        </p>
        <p className={h.calcNote}>{words.note}</p>
        {action}
      </div>
    </div>
  );
}
