"use client";

import { useEffect, useState } from "react";
import { LocalizedDateInput } from "@/components/localized-date-input";
import { SectionHeader } from "@/components/ui";
import { getCalendarOption } from "@/lib/i18n/calendars";

export function ComplianceFields({
  calendar,
  inputClass,
  preferredLocale
}: {
  calendar?: string | null;
  inputClass: string;
  preferredLocale?: string | null;
}) {
  const [taxExpiryDate, setTaxExpiryDate] = useState("");
  const [porborExpiryDate, setPorborExpiryDate] = useState("");
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState("");
  const calendarOption = getCalendarOption(calendar, preferredLocale);

  useEffect(() => {
    function handleOcr(event: Event) {
      const detail = (event as CustomEvent).detail || {};
      setTaxExpiryDate(detail.taxExpiryDate || "");
      setPorborExpiryDate(detail.porborExpiryDate || "");
      setInsuranceExpiryDate(detail.insuranceExpiryDate || "");
    }

    window.addEventListener("vehicle-logbook-ocr", handleOcr);
    return () => window.removeEventListener("vehicle-logbook-ocr", handleOcr);
  }, []);

  return (
    <div className="rounded-2xl border border-[#fecaca] bg-[var(--danger-light)] p-4">
      <SectionHeader eyebrow="Compliance & Renewals" title="Critical dates" />
      <p className="mt-2 text-sm text-[var(--muted)]">{calendarOption.helper}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-[#344054]">Vehicle tax expiry (ต่อภาษี)</span>
          <LocalizedDateInput calendar={calendar} inputClass={inputClass} name="taxExpiryDate" onChange={(event) => setTaxExpiryDate(event.target.value)} preferredLocale={preferredLocale} value={taxExpiryDate} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-[#344054]">Compulsory insurance expiry (พรบ)</span>
          <LocalizedDateInput calendar={calendar} inputClass={inputClass} name="porborExpiryDate" onChange={(event) => setPorborExpiryDate(event.target.value)} preferredLocale={preferredLocale} value={porborExpiryDate} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-[#344054]">Voluntary insurance expiry</span>
          <LocalizedDateInput calendar={calendar} inputClass={inputClass} name="insuranceExpiryDate" onChange={(event) => setInsuranceExpiryDate(event.target.value)} preferredLocale={preferredLocale} value={insuranceExpiryDate} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-[#344054]">Voluntary insurance type</span>
          <select className={inputClass} name="voluntaryInsuranceType">
            <option value="">Select cover type</option>
            <option value="class_1">Class 1 / Type 1 comprehensive</option>
            <option value="class_2_plus">Class 2+ / Type 2+</option>
            <option value="class_2">Class 2 / Type 2</option>
            <option value="class_3_plus">Class 3+ / Type 3+</option>
            <option value="class_3">Class 3 / Type 3 third-party</option>
            <option value="rental_commercial">Rental/commercial policy</option>
            <option value="unknown">Unknown / check policy</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-[#344054]">Next service due</span>
          <LocalizedDateInput calendar={calendar} inputClass={inputClass} name="nextServiceDate" preferredLocale={preferredLocale} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-[#344054]">Oil change due</span>
          <LocalizedDateInput calendar={calendar} inputClass={inputClass} name="oilChangeDueDate" preferredLocale={preferredLocale} />
        </label>
      </div>
    </div>
  );
}
