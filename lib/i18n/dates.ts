import { customerDate } from "@/lib/i18n/customer-dates";

/**
 * Dates on staff pages, in the reader's language. One place, so a screen never
 * mixes "4 Oct" with "4 ต.ค.".
 *
 * Always the Western calendar and Western digits (the same as on agreements and
 * beside amounts). Burmese, Lao and Sinhala month names are kept in the app
 * (see customer-dates.ts) because browsers do not all carry them.
 */

/** The locale to hand to Intl for this language. */
export function intlLocale(locale: string) {
  return locale === "en" ? "en-GB" : `${locale}-u-ca-gregory-nu-latn`;
}

/**
 * Weekday and month names for the languages Chrome has no date wording for (it
 * falls back to English in the browser while the server writes them properly, so
 * the page would flicker and log a mismatch). Sunday first.
 */
const OWN_NAMES: Record<string, { wLong: string[]; wShort: string[]; wNarrow: string[]; mLong: string[]; mShort: string[]; yearFirst: boolean }> = {
  my: {
    wLong: ["တနင်္ဂနွေ", "တနင်္လာ", "အင်္ဂါ", "ဗုဒ္ဓဟူး", "ကြာသပတေး", "သောကြာ", "စနေ"],
    wShort: ["နွေ", "လာ", "ဂါ", "ဟူး", "တေး", "ကြာ", "နေ"],
    wNarrow: ["နွေ", "လာ", "ဂါ", "ဟူး", "တေး", "ကြာ", "နေ"],
    mLong: ["ဇန်နဝါရီ", "ဖေဖော်ဝါရီ", "မတ်", "ဧပြီ", "မေ", "ဇွန်", "ဇူလိုင်", "ဩဂုတ်", "စက်တင်ဘာ", "အောက်တိုဘာ", "နိုဝင်ဘာ", "ဒီဇင်ဘာ"],
    mShort: ["ဇန်", "ဖေ", "မတ်", "ဧ", "မေ", "ဇွန်", "ဇူ", "ဩ", "စက်", "အောက်", "နို", "ဒီ"],
    yearFirst: true,
  },
  lo: {
    wLong: ["ວັນອາທິດ", "ວັນຈັນ", "ວັນອັງຄານ", "ວັນພຸດ", "ວັນພະຫັດ", "ວັນສຸກ", "ວັນເສົາ"],
    wShort: ["ອາ.", "ຈ.", "ອ.", "ພ.", "ພຫ.", "ສຸ.", "ສ."],
    wNarrow: ["ອາ", "ຈ", "ອ", "ພ", "ພຫ", "ສຸ", "ສ"],
    mLong: ["ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ", "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ"],
    mShort: ["ມ.ກ.", "ກ.ພ.", "ມ.ນ.", "ມ.ສ.", "ພ.ພ.", "ມິ.ຖ.", "ກ.ລ.", "ສ.ຫ.", "ກ.ຍ.", "ຕ.ລ.", "ພ.ຈ.", "ທ.ວ."],
    yearFirst: false,
  },
  si: {
    wLong: ["ඉරිදා", "සඳුදා", "අඟහරුවාදා", "බදාදා", "බ්‍රහස්පතින්දා", "සිකුරාදා", "සෙනසුරාදා"],
    wShort: ["ඉරි", "සඳු", "අඟ", "බදා", "බ්‍රහ", "සිකු", "සෙන"],
    wNarrow: ["ඉ", "ස", "අ", "බ", "බ්‍ර", "සි", "සෙ"],
    mLong: ["ජනවාරි", "පෙබරවාරි", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝස්තු", "සැප්තැම්බර්", "ඔක්තෝබර්", "නොවැම්බර්", "දෙසැම්බර්"],
    mShort: ["ජන", "පෙබ", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝ", "සැප්", "ඔක්", "නොවැ", "දෙසැ"],
    yearFirst: true,
  },
};

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Use instead of `new Intl.DateTimeFormat(intlLocale(locale), options)` anywhere a
 * date can be written in the browser: the same text on the server and in every
 * browser, for every language.
 */
export function dateFormat(locale: string, options: Intl.DateTimeFormatOptions): { format: (date: Date | number) => string } {
  const own = OWN_NAMES[locale];
  if (!own) return new Intl.DateTimeFormat(intlLocale(locale), options);
  const reader = new Intl.DateTimeFormat("en-US", {
    timeZone: options.timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return {
    format(date) {
      const parts = Object.fromEntries(reader.formatToParts(date).map((part) => [part.type, part.value]));
      const weekday = WEEKDAY_INDEX[parts.weekday] ?? 0;
      const month = Number(parts.month) - 1;
      const w = options.weekday === "long" ? own.wLong[weekday] : options.weekday === "narrow" ? own.wNarrow[weekday] : options.weekday ? own.wShort[weekday] : "";
      const m = options.month === "long" ? own.mLong[month] : options.month ? own.mShort[month] : "";
      const d = options.day ? String(Number(parts.day)) : "";
      const y = options.year ? parts.year : "";
      const datePart = (own.yearFirst ? [y, m, d] : [d, m, y]).filter(Boolean).join(" ");
      const time = options.hour || options.minute ? `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}` : "";
      return [w, datePart, time].filter(Boolean).join(" ");
    },
  };
}

/** "2026-09-27" -> "27 Sep". */
export function shortDate(iso: string | null | undefined, locale: string) {
  return customerDate(String(iso || ""), locale, false);
}

/** "2026-09-27" -> "27 Sep 2026". */
export function longDate(iso: string | null | undefined, locale: string) {
  return customerDate(String(iso || ""), locale, true);
}

/** This year's dates without the year ("27 Sep"), other years with it ("27 Sep 2025"). */
export function sinceDate(iso: string | null | undefined, locale: string) {
  const value = String(iso || "");
  const thisYear = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date());
  return value.slice(0, 4) === thisYear ? shortDate(value, locale) : longDate(value, locale);
}

/** "2026-09-30" -> "Wed 30 Sep". Server-rendered pages only for Burmese, Lao and Sinhala (the weekday comes from Intl). */
export function dayOfWeekDate(iso: string | null | undefined, locale: string) {
  const value = String(iso || "");
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const weekday = dateFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
  return `${weekday} ${shortDate(value, locale)}`;
}
