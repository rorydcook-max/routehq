"use client";

import { useState } from "react";

const CURRENCY_INFO: Record<string, { symbol: string; locale: string }> = {
  THB: { symbol: "฿", locale: "th-TH" },
  IDR: { symbol: "Rp", locale: "id-ID" },
  PHP: { symbol: "₱", locale: "en-PH" },
  MYR: { symbol: "RM", locale: "ms-MY" },
  SGD: { symbol: "S$", locale: "en-SG" },
  VND: { symbol: "₫", locale: "vi-VN" },
  AUD: { symbol: "A$", locale: "en-AU" },
  GBP: { symbol: "£", locale: "en-GB" },
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "€", locale: "de-DE" },
};

/** Currencies with no smaller unit in everyday use. Everything else takes two decimals (satang, cents). */
const NO_DECIMALS = new Set(["IDR", "VND"]);

/** What was typed, cleaned to a plain number string: digits, and one point with up to two decimals ("1200.5"). */
function cleanAmount(typed: string, decimals: number): string {
  const kept = typed.replace(/[^0-9.]/g, "");
  if (!decimals) return kept.replace(/\./g, "");
  const point = kept.indexOf(".");
  if (point === -1) return kept;
  return `${kept.slice(0, point)}.${kept.slice(point + 1).replace(/\./g, "").slice(0, decimals)}`;
}

/** Thousands separated as you type, the decimals left exactly as typed ("1,200.5" stays "1,200.5" while typing). */
function formatAmount(raw: string): string {
  if (!raw) return "";
  const [whole, fraction] = raw.split(".");
  const grouped = whole ? Number(whole).toLocaleString("en-US") : "0";
  return fraction !== undefined ? `${grouped}.${fraction}` : grouped;
}

/**
 * A currency-prefixed monetary input for server-rendered forms.
 * Uses a single visible text input with an absolutely-positioned symbol overlay.
 * A hidden input carries the plain number ("1200.50") so the server action receives
 * no formatting, regardless of locale. Satang and cents can be typed (Rory, 2 Nov 2026).
 */
export function MoneyInput({
  name,
  defaultValue = "",
  currency = "THB",
  required = false,
  onValueChange
}: {
  name: string;
  defaultValue?: string | number;
  currency?: string;
  required?: boolean;
  /** Told the plain amount ("1200.5") each time it changes. */
  onValueChange?: (amount: string) => void;
}) {
  const info = CURRENCY_INFO[currency] ?? CURRENCY_INFO["THB"];
  const decimals = NO_DECIMALS.has(currency) ? 0 : 2;
  // A saved amount starts as it is: 1200.5 shows 1,200.50, a whole 1200 shows 1,200.
  const startNumber = Number(String(defaultValue ?? "").replace(/,/g, ""));
  const initial =
    String(defaultValue ?? "").trim() !== "" && Number.isFinite(startNumber)
      ? decimals && !Number.isInteger(startNumber)
        ? startNumber.toFixed(decimals)
        : String(Math.round(startNumber))
      : "";
  const [raw, setRaw] = useState(initial);
  const [display, setDisplay] = useState(formatAmount(initial));
  return (
    <div className="relative mt-1">
      {/* Symbol overlay — always visible, never editable */}
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm font-medium text-[var(--foreground-secondary)]">
        {info.symbol}
      </span>
      {/* Hidden input: carries the plain amount — this is what the server action reads */}
      <input type="hidden" name={name} value={raw} />
      {/* Visible formatted input: no name so it is not submitted */}
      <input
        className="input-with-leading-symbol font-mono-data w-full rounded-xl border border-[var(--border-strong)] bg-white py-3 pr-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
        inputMode={decimals ? "decimal" : "numeric"}
        placeholder="0"
        required={required}
        type="text"
        value={display}
        onChange={(e) => {
          const amount = cleanAmount(e.target.value, decimals);
          setRaw(amount);
          onValueChange?.(amount);
          setDisplay(formatAmount(amount));
        }}
      />
    </div>
  );
}
