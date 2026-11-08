"use client";

import { useEffect, useId, useState } from "react";
import { CONSENT_OPEN_EVENT, exposeConsentApi, getConsent, setConsent } from "@/lib/consent";
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
 * The cookie notice (3 Nov 2026), on the website (rovehq.io) and the platform (rovehq.app, 4 Nov 2026: each domain
 * keeps its own choice). The same in every prerendered page; a visitor who has already chosen has it hidden before the
 * first paint (consentChosenScript in each layout's <head>), and taken away once the page's scripts run. Accept and Reject are the same size and weight (ICO, EDPB); nothing behind it
 * is covered or blocked. "Cookie choices" (the website's footer, My account in the app) opens it again.
 * Never shown on customer booking pages: nothing optional runs there (components/google-tag-manager.tsx).
 */
export function CookieBanner({ words }: { words: CookieWords }) {
  // Drawn with the page (task perf, 8 Nov 2026), not after its scripts have loaded: it was the last thing to appear on
  // a phone, seconds after everything else. The same for everyone, so cached pages still work: lib/consent.ts
  // consentChosenScript (in the layout's <head>) hides it before the first paint for a visitor who has already chosen (html[data-consent-set], cookie-banner.module.css).
  const [open, setOpen] = useState(true);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const titleId = useId();
  const switchId = useId();

  useEffect(() => {
    exposeConsentApi();
    const current = getConsent();
    if (current) setOpen(false);
    const reopen = () => {
      document.documentElement.removeAttribute("data-consent-set");
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
    <>
      {/* light-island: the same light card in the app's dark mode (theme-dark.css), as on the website. */}
      <section aria-labelledby={titleId} className={`light-island ${c.banner}`} role="region">
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
            <button className={`${c.button} ${c.wide}`} onClick={() => decide(analytics)} type="button">
              {words.save}
            </button>
          </div>
        </div>
      ) : (
        <div className={c.actions}>
          <button className={`${c.button} ${c.equal}`} onClick={() => decide(false)} type="button">
            {words.reject}
          </button>
          <button className={`${c.button} ${c.equal}`} onClick={() => decide(true)} type="button">
            {words.accept}
          </button>
          <button className={c.more} onClick={() => setDetails(true)} type="button">
            {words.choices}
          </button>
        </div>
      )}
      </section>
    </>
  );
}
