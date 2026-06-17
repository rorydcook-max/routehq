import type { InputHTMLAttributes } from "react";
import { getCalendarOption } from "@/lib/i18n/calendars";

type LocalizedDateInputProps = InputHTMLAttributes<HTMLInputElement> & {
  calendar?: string | null;
  preferredLocale?: string | null;
  inputClass: string;
};

export function LocalizedDateInput({ calendar, preferredLocale, inputClass, ...props }: LocalizedDateInputProps) {
  const calendarOption = getCalendarOption(calendar, preferredLocale);

  return (
    <input
      {...props}
      className={inputClass}
      data-calendar={calendarOption.code}
      lang={calendarOption.locale}
      type="date"
    />
  );
}
