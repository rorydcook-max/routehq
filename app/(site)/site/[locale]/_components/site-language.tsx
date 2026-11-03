"use client";

import { useLocale } from "next-intl";
import { ChevronDown, Globe } from "lucide-react";
import { chooseSignedOutLanguage, signedOutLanguages } from "@/components/auth-language";
import s from "../site.module.css";

/**
 * The language picker on the website's ink header: the same list and the same choice as the footer and sign-in pages
 * (AuthLanguage). A native select laid over a pill, so phones open their own picker and it reads as one control.
 * "compact" (desktop header): a globe and the language code. "row" (phone menu): full width, with the language's name.
 */
export function SiteLanguage({ label, variant }: { label: string; variant: "compact" | "row" }) {
  const locale = useLocale();
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
