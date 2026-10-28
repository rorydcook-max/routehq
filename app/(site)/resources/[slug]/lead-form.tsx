"use client";

import { useActionState, useEffect, useRef } from "react";
import { ChevronDown, FileDown } from "lucide-react";
import { requestLead } from "@/app/actions/leads";
import { LEAD_FLEETS, type LeadState } from "@/lib/leads";
import s from "../../site.module.css";
import c from "../../content.module.css";

const initial: LeadState = { n: 0 };
const FLEET_KEYS: Record<string, string> = { "1-5": "fleet1", "6-20": "fleet2", "21-50": "fleet3", "50+": "fleet4" };
const ERROR_KEYS = { required: "leadRequired", email: "leadEmailInvalid", tooMany: "leadTooMany", failed: "leadError" } as const;

/**
 * The form in front of a free download: email (the one thing asked for), then name, business, country and fleet size,
 * and the tips box, unticked. Once sent, the download buttons take its place. Works without JavaScript too.
 */
export function LeadForm({ resource, source, words, countries }: { resource: string; source: string; words: Record<string, string>; countries: Array<{ code: string; name: string }> }) {
  const [state, action, pending] = useActionState(requestLead, initial);
  const done = useRef<HTMLDivElement>(null);
  const error = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.status === "sent") done.current?.focus();
    if (state.status === "error") error.current?.focus();
  }, [state]);

  if (state.status === "sent") {
    return (
      <div ref={done} role="status" tabIndex={-1} className="outline-none">
        <p className={c.gateTitle}>{state.emailed ? words.leadThanks : words.leadThanksNoEmail}</p>
        <div className={c.downloads}>
          {(state.downloads || []).map((item) => (
            <a className={`${c.download} ${item.primary ? c.downloadPrimary : ""}`} download href={item.href} key={item.href}>
              <FileDown aria-hidden="true" className={c.downloadIcon} size={22} />
              <span className={c.downloadText}>
                {item.label}
                <small>{item.detail}</small>
              </span>
            </a>
          ))}
        </div>
        <p className={c.gateNote}>{words.leadLinkNote}</p>
      </div>
    );
  }

  const v = state.values;
  const invalid = state.status === "error";
  return (
    <form action={action} className={`${s.form} ${c.gateForm}`} noValidate>
      {invalid && state.error ? (
        <p className={s.formError} ref={error} role="alert" tabIndex={-1}>
          {words[ERROR_KEYS[state.error]]}
        </p>
      ) : null}
      <input name="resource" type="hidden" value={resource} />
      <input name="source" type="hidden" value={source} />
      {/* Keyed by the attempt, so a failed send draws the fields again holding what was typed. */}
      <div className={s.formFields} key={state.n}>
        <label className={s.field}>
          <span className={s.fieldLabel}>{words.leadEmail}</span>
          <input aria-invalid={invalid && (state.error === "email" || state.error === "required") ? true : undefined} autoComplete="email" className={s.input} defaultValue={v?.email} dir="ltr" inputMode="email" maxLength={200} name="email" required type="email" />
        </label>
        <label className={s.field}>
          <span className={s.fieldLabel}>{words.leadName}</span>
          <input autoComplete="name" className={s.input} defaultValue={v?.name} maxLength={120} name="name" />
        </label>
        <label className={s.field}>
          <span className={s.fieldLabel}>{words.leadBusiness}</span>
          <input autoComplete="organization" className={s.input} defaultValue={v?.business} maxLength={120} name="business" />
        </label>
        <div className={`${s.formPair} ${c.stack}`}>
          <label className={s.field}>
            <span className={s.fieldLabel}>{words.leadCountry}</span>
            <span className={s.selectWrap}>
              <select className={`${s.input} ${s.inputSelect}`} defaultValue={v?.country || ""} name="country">
                <option value="">—</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
                <option value="other">{words.countryOther}</option>
              </select>
              <ChevronDown aria-hidden="true" className={s.selectChevron} size={18} />
            </span>
          </label>
          <label className={s.field}>
            <span className={s.fieldLabel}>{words.leadFleet}</span>
            <span className={s.selectWrap}>
              <select className={`${s.input} ${s.inputSelect}`} defaultValue={v?.fleet || ""} name="fleet">
                <option value="">—</option>
                {LEAD_FLEETS.map((code) => (
                  <option key={code} value={code}>
                    {words[FLEET_KEYS[code]]}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className={s.selectChevron} size={18} />
            </span>
          </label>
        </div>
        <label className={c.consent}>
          <input defaultChecked={v?.consent || false} name="consent" type="checkbox" />
          <span>{words.leadConsent}</span>
        </label>
        {/* For bots only: hidden from people and screen readers, never focused. */}
        <div aria-hidden="true" className={s.hp}>
          <label>
            Website
            <input autoComplete="off" name="website" tabIndex={-1} />
          </label>
        </div>
      </div>
      <button className={`${s.btn} ${s.btnInk} ${c.gateSend}`} disabled={pending} type="submit">
        {pending ? words.leadSending : words.leadButton}
      </button>
      <p className={c.privacy}>{words.leadPrivacy}</p>
    </form>
  );
}
