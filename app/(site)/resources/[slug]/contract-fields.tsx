"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CONTRACT_CURRENCY, CONTRACT_DEFAULTS, CURRENCIES, contractCountryFor } from "@/lib/contract-builder/fields";
import s from "../../site.module.css";
import c from "../../content.module.css";

type Words = Record<string, string>;

/**
 * The contract builder's optional fields, folded away under "Fill in your agreement": business (with logo), vehicle,
 * prices and rules. Everything is optional; blanks print as lines to fill in by hand. The currency follows the
 * country chosen above until the operator picks one themselves.
 */
export function ContractFields({ words, country }: { words: Words; country: string }) {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<string | null>(null);
  const shownCurrency = currency || CONTRACT_CURRENCY[contractCountryFor(country)];
  const w = (key: string) => words[key] || key;

  const text = (key: string, opts: { type?: string; inputMode?: "numeric" | "decimal" | "email" | "tel"; placeholder?: string; wide?: boolean } = {}) => (
    <label className={`${s.field} ${opts.wide ? c.cbWide : ""}`} key={key}>
      <span className={s.fieldLabel}>{w(`cb_${key}`)}</span>
      <input
        className={s.input}
        inputMode={opts.inputMode}
        maxLength={opts.inputMode === "numeric" || opts.inputMode === "decimal" ? 14 : 160}
        name={`c_${key}`}
        placeholder={opts.placeholder}
        type={opts.type || "text"}
      />
    </label>
  );
  const money = (key: string) => text(key, { inputMode: "decimal", placeholder: shownCurrency });
  // A skipped number falls back to the agreement's default, so show it as the placeholder.
  const number = (key: string) => text(key, { inputMode: "numeric", placeholder: CONTRACT_DEFAULTS[key] });
  const select = (key: string, options: readonly string[], opts: { blank?: boolean; value?: string; onChange?: (value: string) => void } = {}) => (
    <label className={s.field} key={key}>
      <span className={s.fieldLabel}>{w(`cb_${key}`)}</span>
      <span className={s.selectWrap}>
        <select
          className={`${s.input} ${s.inputSelect}`}
          name={`c_${key}`}
          {...(opts.value !== undefined ? { value: opts.value, onChange: (event) => opts.onChange?.(event.target.value) } : { defaultValue: opts.blank ? "" : options[0] })}
        >
          {opts.blank ? <option value="">—</option> : null}
          {options.map((option) => (
            <option key={option} value={option}>
              {words[`cb_${key}_${option}`] || option}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" className={s.selectChevron} size={18} />
      </span>
    </label>
  );

  return (
    <div className={c.cb}>
      <button aria-expanded={open} className={c.cbToggle} onClick={() => setOpen(!open)} type="button">
        <span>
          <strong>{w("cbTitle")}</strong>
          <small>{w("cbBody")}</small>
        </span>
        <ChevronDown aria-hidden="true" className={open ? c.cbChevronOpen : c.cbChevron} size={20} />
      </button>
      {/* Hidden rather than removed when folded, so what was typed is still sent. */}
      <div className={c.cbBody} hidden={!open}>
        <fieldset className={c.cbGroup}>
          <legend>{w("cbGroupBusiness")}</legend>
          <label className={`${s.field} ${c.cbWide}`}>
            <span className={s.fieldLabel}>{w("cb_logo")}</span>
            <input accept="image/png,image/jpeg" className={c.cbFile} name="c_logo" type="file" />
          </label>
          {text("business_reg_no")}
          {text("business_phone", { inputMode: "tel" })}
          {text("business_email", { type: "email", inputMode: "email" })}
          <label className={`${s.field} ${c.cbWide}`}>
            <span className={s.fieldLabel}>{w("cb_business_address")}</span>
            <textarea className={`${s.input} ${c.cbArea}`} maxLength={240} name="c_business_address" rows={2} />
          </label>
        </fieldset>

        <fieldset className={c.cbGroup}>
          <legend>{w("cbGroupVehicle")}</legend>
          {select("vehicle_type", ["car", "motorbike"], { blank: true })}
          {text("vehicle_make_model")}
          {text("vehicle_year", { inputMode: "numeric" })}
          {text("vehicle_plate")}
          {text("vehicle_colour")}
          {text("area_of_use", { wide: true, placeholder: w("cb_area_of_use_hint") })}
        </fieldset>

        <fieldset className={c.cbGroup}>
          <legend>{w("cbGroupPrices")}</legend>
          {select("currency", CURRENCIES, { value: shownCurrency, onChange: setCurrency })}
          {money("rate")}
          {select("rate_period", ["day", "week", "month"])}
          {money("deposit")}
          {number("deposit_return_days")}
          {money("delivery_fee")}
          {text("payment_methods", { wide: true, placeholder: w("cb_payment_methods_hint") })}
          {select("insurance_level", ["compulsory", "third_party", "comprehensive"])}
          {money("insurance_excess")}
        </fieldset>

        <fieldset className={c.cbGroup}>
          <legend>{w("cbGroupRules")}</legend>
          {select("fuel_policy", ["same", "full"])}
          {money("fuel_service_fee")}
          {number("mileage_limit")}
          {select("mileage_period", ["day", "month"])}
          {money("excess_km_fee")}
          {money("late_hour_fee")}
          {number("late_grace_minutes")}
          {number("late_full_day_hours")}
          {number("cancel_free_hours")}
          {number("cancel_fee_percent")}
          {select("early_return", ["none", "prorata"])}
          {money("early_return_fee")}
          {number("notice_days")}
          {money("cleaning_fee")}
          {select("smoking", ["no", "yes"])}
          {money("smoking_fee")}
          {select("pets", ["no", "fee"])}
          {money("pet_fee")}
          {money("loss_of_use_fee")}
          {money("emergency_repair_limit")}
          {money("fine_admin_fee")}
          <label className={`${s.field} ${c.cbWide}`}>
            <span className={s.fieldLabel}>{w("cb_special_terms")}</span>
            <textarea className={`${s.input} ${c.cbArea}`} maxLength={1200} name="c_special_terms" rows={3} />
          </label>
        </fieldset>
        <p className={c.cbNote}>{w("cbBlankNote")}</p>
      </div>
    </div>
  );
}
