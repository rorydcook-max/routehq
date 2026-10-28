"use client";

import { useActionState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { sendContactMessage } from "@/app/actions/contact";
import { CONTACT_FLEETS, CONTACT_TOPICS, type ContactState } from "@/lib/contact";
import s from "../site.module.css";

const initial: ContactState = { n: 0 };
const FLEET_KEYS: Record<string, string> = { "1-5": "fleet1", "6-20": "fleet2", "21-50": "fleet3", "50+": "fleet4" };
const TOPIC_KEYS: Record<string, string> = { general: "topicGeneral", import: "topicImport", pricing: "topicPricing", partner: "topicPartner", other: "topicOther" };
const ERROR_KEYS = { required: "contactRequired", email: "contactEmailInvalid", tooMany: "contactTooMany", failed: "contactError" } as const;

/** The contact form: labels above, 48px fields, the thanks in place of the form once sent. Works without JavaScript too. */
export function ContactForm({ words }: { words: Record<string, string> }) {
  const [state, action, pending] = useActionState(sendContactMessage, initial);
  const thanks = useRef<HTMLDivElement>(null);
  const error = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.status === "sent") thanks.current?.focus();
    if (state.status === "error") error.current?.focus();
  }, [state]);

  if (state.status === "sent") {
    return (
      <div className={s.thanks} ref={thanks} role="status" tabIndex={-1}>
        <p>{words.contactThanks}</p>
      </div>
    );
  }

  const v = state.values;
  const invalid = state.status === "error";
  return (
    <form action={action} className={s.form} noValidate>
      {invalid && state.error ? (
        <p className={s.formError} ref={error} role="alert" tabIndex={-1}>
          {words[ERROR_KEYS[state.error]]}
        </p>
      ) : null}
      {/* Keyed by the attempt, so a failed send draws the fields again holding what was typed. */}
      <div className={s.formFields} key={state.n}>
        <div className={s.formPair}>
          <label className={s.field}>
            <span className={s.fieldLabel}>{words.contactName}</span>
            <input aria-invalid={invalid && state.error === "required" && !v?.name ? true : undefined} autoComplete="name" className={s.input} defaultValue={v?.name} maxLength={120} name="name" required />
          </label>
          <label className={s.field}>
            <span className={s.fieldLabel}>{words.contactEmail}</span>
            <input aria-invalid={invalid && (state.error === "email" || (state.error === "required" && !v?.email)) ? true : undefined} autoComplete="email" className={s.input} defaultValue={v?.email} dir="ltr" inputMode="email" maxLength={200} name="email" required type="email" />
          </label>
        </div>
        <div className={s.formPair}>
          <label className={s.field}>
            <span className={s.fieldLabel}>{words.contactPhone}</span>
            <input autoComplete="tel" className={s.input} defaultValue={v?.phone} maxLength={40} name="phone" />
          </label>
          <label className={s.field}>
            <span className={s.fieldLabel}>{words.contactBusiness}</span>
            <input autoComplete="organization" className={s.input} defaultValue={v?.business} maxLength={120} name="business" />
          </label>
        </div>
        <div className={s.formPair}>
          <label className={s.field}>
            <span className={s.fieldLabel}>{words.contactFleet}</span>
            <span className={s.selectWrap}>
              <select className={`${s.input} ${s.inputSelect}`} defaultValue={v?.fleet || ""} name="fleet">
                <option value="">—</option>
                {CONTACT_FLEETS.map((code) => (
                  <option key={code} value={code}>
                    {words[FLEET_KEYS[code]]}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className={s.selectChevron} size={18} />
            </span>
          </label>
          <label className={s.field}>
            <span className={s.fieldLabel}>{words.contactTopic}</span>
            <span className={s.selectWrap}>
              <select className={`${s.input} ${s.inputSelect}`} defaultValue={v?.topic || "general"} name="topic">
                {CONTACT_TOPICS.map((code) => (
                  <option key={code} value={code}>
                    {words[TOPIC_KEYS[code]]}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className={s.selectChevron} size={18} />
            </span>
          </label>
        </div>
        <label className={s.field}>
          <span className={s.fieldLabel}>{words.contactMessage}</span>
          <textarea aria-invalid={invalid && state.error === "required" && !v?.message ? true : undefined} className={`${s.input} ${s.textarea}`} defaultValue={v?.message} maxLength={4000} name="message" required rows={6} />
        </label>
        {/* For bots only: hidden from people and screen readers, never focused. */}
        <div aria-hidden="true" className={s.hp}>
          <label>
            Website
            <input autoComplete="off" name="website" tabIndex={-1} />
          </label>
        </div>
      </div>
      <button className={`${s.btn} ${s.btnInk} ${s.formSend}`} disabled={pending} type="submit">
        {pending ? words.contactSending : words.contactSend}
      </button>
    </form>
  );
}
