"use client";

import { useState, type ReactNode } from "react";
import h from "../home.module.css";

type Words = { title: string; lede: string; bookings: string; minutes: string; worth: string; hours: string; days: string; value: string; note: string };
/** The "what an hour is worth" slider, in the visitor's money: where it starts and how far it goes. */
type Worth = { currency: string; locale: string; start: number; min: number; max: number; step: number };

/**
 * "How much of your month is paperwork?" (home page, 12 Nov 2026). The visitor moves three sliders with their own
 * numbers and sees the hours, and the money, that adds up to. It is plain arithmetic on what they enter: no claim
 * of ours in it.
 */
export function TimeCalc({ words, worth, action }: { words: Words; worth: Worth; action: ReactNode }) {
  const [bookings, setBookings] = useState(40);
  const [minutes, setMinutes] = useState(25);
  const [rate, setRate] = useState(worth.start);
  const hours = Math.round((bookings * minutes) / 60);
  const days = Math.round((hours * 12) / 8);
  const money = (amount: number) => {
    try {
      return new Intl.NumberFormat(worth.locale, { style: "currency", currency: worth.currency, maximumFractionDigits: 0 }).format(amount);
    } catch {
      return `${worth.currency} ${Math.round(amount).toLocaleString("en-US")}`;
    }
  };
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
        <label className={h.calcField}>
          <span>
            {words.worth} <output>{money(rate)}</output>
          </span>
          <input max={worth.max} min={worth.min} onChange={(event) => setRate(Number(event.target.value))} step={worth.step} type="range" value={rate} />
        </label>
      </div>
      <div aria-live="polite" className={h.calcResult}>
        <p className={h.calcBig}>{hours}</p>
        <p className={h.calcUnit}>{words.hours}</p>
        <ul className={h.calcFacts}>
          <li>
            <strong>{days}</strong> {words.days}
          </li>
          <li>
            <strong>{money(hours * rate)}</strong> {words.value}
          </li>
        </ul>
        <p className={h.calcNote}>{words.note}</p>
        {action}
      </div>
    </div>
  );
}
