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

function formatAmount(digits: string, locale: string): string {
  if (!digits) return "";
  const n = parseInt(digits, 10);
  return isNaN(n) ? "" : new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

/**
 * A currency-prefixed monetary input for server-rendered forms.
 * Uses a single visible text input with an absolutely-positioned symbol overlay.
 * A hidden input carries the raw digit value so the server action receives
 * a plain number string (no formatting), regardless of locale.
 */
export function MoneyInput({
  name,
  defaultValue = "",
  currency = "THB",
  required = false
}: {
  name: string;
  defaultValue?: string | number;
  currency?: string;
  required?: boolean;
}) {
  const info = CURRENCY_INFO[currency] ?? CURRENCY_INFO["THB"];
  const initialDigits = String(defaultValue ?? "").replace(/[^0-9]/g, "");
  const [raw, setRaw] = useState(initialDigits);
  const [display, setDisplay] = useState(formatAmount(initialDigits, info.locale));

  return (
    <div className="relative mt-1">
      {/* Symbol overlay — always visible, never editable */}
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm font-medium text-[var(--foreground-secondary)]">
        {info.symbol}
      </span>
      {/* Hidden input: carries raw digits — this is what the server action reads */}
      <input type="hidden" name={name} value={raw} />
      {/* Visible formatted input: no name so it is not submitted */}
      <input
        className="input-with-leading-symbol font-mono-data w-full rounded-xl border border-[var(--border-strong)] bg-white py-3 pr-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
        inputMode="numeric"
        placeholder="0"
        required={required}
        type="text"
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          setRaw(digits);
          setDisplay(formatAmount(digits, info.locale));
        }}
      />
    </div>
  );
}
