"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LocalizedDateInput } from "@/components/localized-date-input";

export const COVER_TYPES = ["class_1", "class_2_plus", "class_2", "class_3_plus", "class_3", "rental_commercial", "unknown"];

export function ComplianceFields({
  calendar,
  inputClass,
  preferredLocale
}: {
  calendar?: string | null;
  inputClass: string;
  preferredLocale?: string | null;
}) {
  const say = useTranslations("vehicleForm") as unknown as (key: string) => string;
  const [taxExpiryDate, setTaxExpiryDate] = useState("");
  const [porborExpiryDate, setPorborExpiryDate] = useState("");
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState("");
  const labelClass = "font-semibold text-[var(--foreground-secondary)]";

  // The blue-book reader fills these in when it finds them.
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
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className={labelClass}>{say("tax")}</span>
        <LocalizedDateInput calendar={calendar} inputClass={inputClass} name="taxExpiryDate" onChange={(event) => setTaxExpiryDate(event.target.value)} preferredLocale={preferredLocale} value={taxExpiryDate} />
      </label>
      <label className="block">
        <span className={labelClass}>{say("porbor")}</span>
        <LocalizedDateInput calendar={calendar} inputClass={inputClass} name="porborExpiryDate" onChange={(event) => setPorborExpiryDate(event.target.value)} preferredLocale={preferredLocale} value={porborExpiryDate} />
      </label>
      <label className="block">
        <span className={labelClass}>{say("insurance")}</span>
        <LocalizedDateInput calendar={calendar} inputClass={inputClass} name="insuranceExpiryDate" onChange={(event) => setInsuranceExpiryDate(event.target.value)} preferredLocale={preferredLocale} value={insuranceExpiryDate} />
      </label>
      <label className="block">
        <span className={labelClass}>{say("cover")}</span>
        <select className={inputClass} name="voluntaryInsuranceType">
          <option value="">{say("choose")}</option>
          {COVER_TYPES.map((type) => (
            <option key={type} value={type}>
              {say(`cover_${type}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelClass}>{say("service")}</span>
        <LocalizedDateInput calendar={calendar} inputClass={inputClass} name="nextServiceDate" preferredLocale={preferredLocale} />
      </label>
      <label className="block">
        <span className={labelClass}>{say("oil")}</span>
        <LocalizedDateInput calendar={calendar} inputClass={inputClass} name="oilChangeDueDate" preferredLocale={preferredLocale} />
      </label>
    </div>
  );
}
