"use client";

import { useLocale } from "next-intl";
import { Globe } from "lucide-react";
import { operatorLocaleOptions } from "@/lib/i18n/locales";
import { STAFF_LOCALE_COOKIE } from "@/lib/i18n/staff-locale";

/** Language choice on the sign-in pages, every language the app is written in. Kept on this device until the person signs in. */
export function AuthLanguage() {
  const locale = useLocale();

  function choose(code: string) {
    document.cookie = `${STAFF_LOCALE_COOKIE}=${code}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.location.reload();
  }

  return (
    <label className="inline-flex items-center gap-2 rounded-full bg-[var(--panel-secondary)] py-1 pl-3 pr-1.5">
      <Globe aria-hidden="true" className="shrink-0 text-[var(--muted)]" size={16} />
      <select aria-label="Language" className="min-h-9 max-w-[14rem] rounded-full border-0 bg-white px-3 font-bold text-[var(--foreground)] shadow-sm" onChange={(event) => choose(event.target.value)} value={locale}>
        {operatorLocaleOptions.map((option) => (
          <option key={option.code} lang={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
