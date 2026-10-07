"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { LAUNCH_LOCALES, STAFF_LOCALE_COOKIE } from "@/lib/i18n/staff-locale";

/** English / Thai switch on the sign-in pages. The choice is kept on this device until the person signs in. */
export function AuthLanguage() {
  const router = useRouter();
  const locale = useLocale();

  function choose(code: string) {
    document.cookie = `${STAFF_LOCALE_COOKIE}=${code}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="flex gap-1 rounded-full bg-[var(--panel-secondary)] p-1" role="group">
      {LAUNCH_LOCALES.map((option) => {
        const active = option.code === locale;
        return (
          <button
            aria-pressed={active}
            className={`pressable min-h-9 rounded-full px-3 font-bold ${active ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--foreground-secondary)]"}`}
            key={option.code}
            lang={option.code}
            onClick={() => choose(option.code)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
