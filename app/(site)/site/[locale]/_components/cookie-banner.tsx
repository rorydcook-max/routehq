"use client";

import { useEffect, useId, useState } from "react";
import { CONSENT_OPEN_EVENT, exposeConsentApi, getConsent, setConsent } from "@/lib/consent";
import s from "../site.module.css";
import c from "./cookie-banner.module.css";

export type CookieWords = {
  body: string;
  accept: string;
  reject: string;
  choices: string;
  choicesTitle: string;
  necessary: string;
  necessaryBody: string;
  alwaysOn: string;
  analytics: string;
  analyticsBody: string;
  save: string;
  policy: string;
  policyHref: string;
};

/**
 * The website's cookie notice (3 Nov 2026). Drawn only in the browser, so the prerendered pages stay the same for
 * everyone: hidden until we know the visitor hasn't chosen yet. Accept and Reject are the same size and weight
 * (ICO, EDPB); nothing behind it is covered or blocked. The footer's "Cookie choices" opens it again.
 */
export function CookieBanner({ words }: { words: CookieWords }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const titleId = useId();
  const switchId = useId();

  useEffect(() => {
    exposeConsentApi();
    const current = getConsent();
    if (!current) setOpen(true);
    const reopen = () => {
      setAnalytics(Boolean(getConsent()?.analytics));
      setDetails(true);
      setOpen(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  if (!open) return null;

  const decide = (yes: boolean) => {
    setConsent({ analytics: yes });
    setOpen(false);
    setDetails(false);
  };

  return (
    <section aria-labelledby={titleId} className={c.banner} role="region">
      <p className={c.body} id={titleId}>
        {words.body}{" "}
        <a className={c.policy} href={words.policyHref}>
          {words.policy}
        </a>
      </p>

      {details ? (
        <div className={c.choices}>
          <p className={c.choicesTitle}>{words.choicesTitle}</p>
          <div className={c.row}>
            <div>
              <p className={c.rowTitle}>{words.necessary}</p>
              <p className={c.rowBody}>{words.necessaryBody}</p>
            </div>
            <span className={c.always}>{words.alwaysOn}</span>
          </div>
          <div className={c.row}>
            <div>
              <label className={c.rowTitle} htmlFor={switchId}>
                {words.analytics}
              </label>
              <p className={c.rowBody}>{words.analyticsBody}</p>
            </div>
            <input checked={analytics} className={c.switch} id={switchId} onChange={(event) => setAnalytics(event.target.checked)} role="switch" type="checkbox" />
          </div>
          <div className={c.actions}>
            <button className={`${s.btn} ${s.btnSmall} ${s.btnInk} ${c.wide}`} onClick={() => decide(analytics)} type="button">
              {words.save}
            </button>
          </div>
        </div>
      ) : (
        <div className={c.actions}>
          <button className={`${s.btn} ${s.btnSmall} ${s.btnInk} ${c.equal}`} onClick={() => decide(false)} type="button">
            {words.reject}
          </button>
          <button className={`${s.btn} ${s.btnSmall} ${s.btnInk} ${c.equal}`} onClick={() => decide(true)} type="button">
            {words.accept}
          </button>
          <button className={c.more} onClick={() => setDetails(true)} type="button">
            {words.choices}
          </button>
        </div>
      )}
    </section>
  );
}
