"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CUSTOMER_LOCALE_COOKIE } from "@/lib/i18n/customer-locale";
import { customerLocaleOptions } from "@/lib/i18n/locales";

/**
 * Lets a customer read their booking in their own language. Each language is
 * listed in its own script, so it can be found by someone who reads no English.
 */
export function CustomerLanguagePicker({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("customer");
  return (
    // Phones: a compact pill (16px text, so iPhones don't zoom in when it's tapped) that leaves the business name room.
    <label className={`inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white ps-3 pe-1 text-[14px] font-semibold text-[var(--foreground-secondary)] shadow-[var(--shadow-card)] ${className}`}>
      <Globe aria-hidden="true" className="shrink-0 text-[var(--primary)]" size={16} />
      <select
        aria-label={t("language")}
        className="!h-auto !w-auto max-w-[118px] cursor-pointer truncate !border-0 !bg-transparent !py-1.5 !pl-0 !pr-6 !text-[16px] font-semibold text-[var(--foreground-secondary)] !shadow-none outline-none sm:max-w-[170px] sm:!text-[14px]"
        onChange={(event) => {
          // A year: the next link this customer opens is in their language too.
          document.cookie = `${CUSTOMER_LOCALE_COOKIE}=${event.target.value}; path=/; max-age=31536000; samesite=lax`;
          window.location.reload();
        }}
        value={locale}
      >
        {customerLocaleOptions.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label.replace(/ \(.*\)$/, "")}
          </option>
        ))}
      </select>
    </label>
  );
}
