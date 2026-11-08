"use client";

import { useLocale } from "next-intl";
import { Globe } from "lucide-react";
import { chooseSignedOutLanguage, signedOutLanguages } from "@/lib/i18n/signed-out-language";

// The choice itself lives in lib/i18n/signed-out-language.ts (task perf2), shared with the website's pickers.
export { chooseSignedOutLanguage, signedOutLanguages };

/**
 * Language choice on the sign-in pages, every language the app is written in. Kept on this device until the person signs in.
 * Drawn as the same compact pill as the customer pages' language picker, so it never outgrows its row.
 */
export function AuthLanguage() {
  const locale = useLocale();
  const choose = chooseSignedOutLanguage;

  return (
    <label className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-white ps-3 pe-1 text-[13px] font-semibold text-[var(--foreground-secondary)]">
      <Globe aria-hidden="true" className="shrink-0 text-[var(--primary)]" size={15} />
      <select
        aria-label="Language"
        className="!h-auto !min-h-0 !w-auto max-w-[150px] cursor-pointer truncate !border-0 !bg-transparent !py-1.5 !pl-0 !pr-6 !text-[13px] font-semibold text-[var(--foreground-secondary)] !shadow-none outline-none"
        onChange={(event) => choose(event.target.value)}
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
