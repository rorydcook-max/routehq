"use client";

import { useEffect, useState } from "react";
import { CUSTOMER_LOCALE_COOKIE } from "@/lib/i18n/customer-locale";
import { parseRovePath, roveHasLocale, roveHref } from "@/lib/rove/paths";
import s from "../rove.module.css";

/**
 * The language list. Each choice is a link to this page in that language (or that language's home page, for a page
 * only written in English so far), and remembers the choice (the same cookie as businesses' booking pages), so
 * rove.rent/ opens in it next time instead of following the phone's language.
 */
export function LanguagePicker({ current, label, short, options }: { current: string; label: string; short: string; options: Array<{ code: string; label: string }> }) {
  const [here, setHere] = useState<{ path: string; search: string; section: Parameters<typeof roveHasLocale>[0] } | null>(null);

  useEffect(() => {
    const page = parseRovePath(window.location.pathname);
    if (page) setHere({ path: page.rest, search: window.location.search, section: page.section });
  }, []);

  const hrefFor = (code: string) => (here && roveHasLocale(here.section, code) ? `${roveHref(here.path, code)}${here.search}` : roveHref("/", code));
  const remember = (code: string) => {
    document.cookie = `${CUSTOMER_LOCALE_COOKIE}=${encodeURIComponent(code)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  };

  return (
    <details className={s.lang}>
      <summary aria-label={label} className={s.navLink}>
        <i aria-hidden="true" className="ti ti-world" style={{ marginInlineEnd: 6, fontSize: 18 }} />
        {short}
      </summary>
      <div className={s.langMenu} role="list">
        {options.map((option) => (
          <a aria-current={option.code === current ? "true" : undefined} className={s.langItem} href={hrefFor(option.code)} hrefLang={option.code} key={option.code} lang={option.code} onClick={() => remember(option.code)} role="listitem">
            {option.label}
          </a>
        ))}
      </div>
    </details>
  );
}
