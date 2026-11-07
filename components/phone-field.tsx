"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { allCountries, countriesSorted, isLocalNumber, readPhone } from "@/lib/customer-options";

/**
 * A phone number with its country (Rory, 1 Nov 2026). Type or paste the whole number, "+262 693 47 87 99" or
 * "00262…", and the country is found by itself; a number without a code stays with the country shown. The
 * country list has every country, alphabetical in the reader's language.
 * Sends `codeName` ("+262") and `inputName` (the number without its code), as the old fields did.
 */
export function PhoneField({
  codeName = "phoneCountryCode",
  inputName = "phone",
  defaultCountry = "",
  defaultNumber = "",
  required = false,
  placeholder,
  inputClass = "",
  onCountryFound,
  followCountry,
  onValueChange
}: {
  codeName?: string;
  inputName?: string;
  defaultCountry?: string;
  defaultNumber?: string;
  required?: boolean;
  placeholder?: string;
  inputClass?: string;
  /** Told when a pasted number reveals the country, so a nationality left untouched can follow it. */
  onCountryFound?: (countryCode: string) => void;
  /** A country chosen elsewhere on the form (ISO code): the code follows it until a number is typed. */
  followCountry?: string;
  /** The whole number in international form ("+66812345678"), or "" when empty, as it changes. */
  onValueChange?: (international: string) => void;
}) {
  const t = useTranslations("customers");
  const locale = useLocale();
  const options = useMemo(() => countriesSorted(locale), [locale]);
  const start = readPhone(defaultNumber, defaultCountry);
  const [country, setCountry] = useState(start.country);
  const [text, setText] = useState(start.national);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // No country yet (the business's country isn't set): just "+", and the number is kept as typed.
  const current = allCountries.find((item) => item.code === country) || null;
  const national = text.replace(/[^\d]/g, "");

  useEffect(() => {
    if (followCountry && !national && allCountries.some((item) => item.code === followCountry)) setCountry(followCountry);
    // Only when the other choice changes: a number already typed keeps its own country.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followCountry]);

  useEffect(() => {
    if (!onValueChange) return;
    if (!national) return onValueChange("");
    if (!current) return onValueChange(national);
    const parsed = parsePhoneNumberFromString(national, current.code as CountryCode);
    onValueChange(parsed?.number || `${current.phoneCode}${national.replace(/^0/, "")}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [national, current?.code]);

  function typed(value: string) {
    const trimmed = value.trim();
    if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
      const read = readPhone(trimmed, country);
      if (read.detected) {
        setCountry(read.country);
        setText(read.national);
        onCountryFound?.(read.country);
        return;
      }
    }
    // A whole number pasted without the "+" (262693478799): use it only if it is a real number that way and is
    // not simply a valid local number for the country shown.
    const digits = trimmed.replace(/[^\d]/g, "");
    if (!trimmed.startsWith("+") && !digits.startsWith("0") && digits.length >= 11 && digits.length - text.replace(/[^\d]/g, "").length > 3) {
      const asInternational = readPhone(`+${digits}`, country);
      if (asInternational.valid && !isLocalNumber(digits, country)) {
        setCountry(asInternational.country);
        setText(asInternational.national);
        onCountryFound?.(asInternational.country);
        return;
      }
    }
    setText(value);
  }

  return (
    <div className="grid grid-cols-[auto_1fr] gap-2">
      <input name={codeName} type="hidden" value={current?.phoneCode || ""} />
      <input name={inputName} type="hidden" value={national} />
      {/* The country: a small button showing the flag and code, with the full alphabetical list behind it. */}
      {/* Drawn like the fields next to it (their border comes from the global field style, which a div doesn't get). */}
      <div
        // Spacing from the field classes only: a class with "rounded" and "border-[var(--border)]" is made borderless
        // inside cards by the global style (meant for boxes, not fields).
        className={`relative flex min-h-11 items-center gap-1.5 whitespace-nowrap px-3 text-[var(--foreground)] ${inputClass
          .split(/\s+/)
          .filter((token) => /^(m[tbxy]?-|w-)/.test(token))
          .join(" ")}`}
        style={{ border: "1.5px solid var(--border-strong)", borderRadius: 12, background: "var(--surface, #fff)", height: 44 }}
      >
        {current ? <span aria-hidden="true">{current.flag}</span> : null}
        <span className="tabular-nums">{current?.phoneCode || "+"}</span>
        <ChevronDown aria-hidden="true" className="shrink-0 text-[var(--muted)]" size={14} />
        <select
          aria-label={t("sel_countryCode")}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(event) => setCountry(event.target.value)}
          value={country}
        >
          {/* Country names come from the browser's own list, which can differ from the server's: build the list after loading. */}
          {!current ? <option value="">+</option> : null}
          {(mounted ? options : options.filter((option) => option.code === country)).map((option) => (
            <option key={option.code} value={option.code}>
              {option.flag} {option.label} {option.phoneCode}
            </option>
          ))}
        </select>
      </div>
      <input
        autoComplete="tel"
        className={inputClass}
        inputMode="tel"
        onChange={(event) => typed(event.target.value)}
        placeholder={placeholder || t("sel_phonePaste")}
        required={required}
        type="tel"
        value={text}
      />
    </div>
  );
}
