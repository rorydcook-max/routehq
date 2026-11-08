"use client";

import { ChevronDown, Globe } from "lucide-react";
import { chooseSignedOutLanguage, signedOutLanguages } from "@/lib/i18n/signed-out-language";
import s from "../site.module.css";

/**
 * The language picker on the website's ink header: the same list and the same choice as the footer and sign-in pages
 * (AuthLanguage). A native select laid over a pill, so phones open their own picker and it reads as one control.
 * "compact" (desktop header): a globe and the language code. "row" (phone menu): full width, with the language's name.
 * The page's language comes from the server (task perf2, 8 Nov 2026): no next-intl in the website's browser code.
 */
export function SiteLanguage({ label, locale, variant }: { label: string; locale: string; variant: "compact" | "row" }) {
  const current = signedOutLanguages.find((option) => option.code === locale);
  return (
    <label className={variant === "row" ? s.langRow : s.langPill}>
      <Globe aria-hidden="true" className={s.langGlobe} size={variant === "row" ? 18 : 16} />
      <span aria-hidden="true" className={s.langText} dir="auto">
        {variant === "row" ? current?.label || locale : locale.toUpperCase()}
      </span>
      <ChevronDown aria-hidden="true" className={s.langChevron} size={variant === "row" ? 18 : 14} />
      <select aria-label={label} className={s.langSelect} onChange={(event) => chooseSignedOutLanguage(event.target.value)} value={locale}>
        {signedOutLanguages.map((option) => (
          <option key={option.code} lang={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The footer's picker: the sign-in pages' pill (components/auth-language.tsx), drawn the same, with the page's language. */
export function FooterLanguage({ locale }: { locale: string }) {
  return (
    <label className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-white ps-3 pe-1 text-[13px] font-semibold text-[var(--foreground-secondary)]">
      <Globe aria-hidden="true" className="shrink-0 text-[var(--primary)]" size={15} />
      <select
        aria-label="Language"
        className="!h-auto !min-h-0 !w-auto max-w-[150px] cursor-pointer truncate !border-0 !bg-transparent !py-1.5 !pl-0 !pr-6 !text-[13px] font-semibold text-[var(--foreground-secondary)] !shadow-none outline-none"
        onChange={(event) => chooseSignedOutLanguage(event.target.value)}
        value={locale}
      >
        {signedOutLanguages.map((option) => (
          <option key={option.code} lang={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
