export const supportedCalendarOptions = [
  {
    code: "gregory",
    label: "English / Gregorian calendar",
    locale: "en-US-u-ca-gregory",
    helper: "Dates use the standard Gregorian calendar."
  },
  {
    code: "buddhist",
    label: "Thai / Buddhist calendar",
    locale: "th-TH-u-ca-buddhist",
    helper: "Dates use Thai locale preferences where the browser supports Buddhist calendar display."
  }
] as const;

export type SupportedCalendarCode = (typeof supportedCalendarOptions)[number]["code"];

export const supportedCalendarCodes = supportedCalendarOptions.map((calendar) => calendar.code);

export function defaultCalendarForLocale(locale: string | null | undefined): SupportedCalendarCode {
  return locale === "th" ? "buddhist" : "gregory";
}

export function getCalendarOption(calendar: string | null | undefined, locale: string | null | undefined) {
  const fallback = defaultCalendarForLocale(locale);
  return supportedCalendarOptions.find((option) => option.code === calendar) || supportedCalendarOptions.find((option) => option.code === fallback)!;
}
