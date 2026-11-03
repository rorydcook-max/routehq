import { customerLocaleOptions } from "@/lib/i18n/locales";
import { displayNamesLocale } from "@/lib/i18n/dates";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

/**
 * Nationalities renters on the islands most often have. Thailand first, then by
 * country name. `name` is what is stored on the customer ("British").
 */
export const commonCountries = [
  { name: "Thai", country: "Thailand", code: "TH", flag: "🇹🇭", phoneCode: "+66" },
  { name: "Argentine", country: "Argentina", code: "AR", flag: "🇦🇷", phoneCode: "+54" },
  { name: "Australian", country: "Australia", code: "AU", flag: "🇦🇺", phoneCode: "+61" },
  { name: "Austrian", country: "Austria", code: "AT", flag: "🇦🇹", phoneCode: "+43" },
  { name: "Bangladeshi", country: "Bangladesh", code: "BD", flag: "🇧🇩", phoneCode: "+880" },
  { name: "Belgian", country: "Belgium", code: "BE", flag: "🇧🇪", phoneCode: "+32" },
  { name: "Brazilian", country: "Brazil", code: "BR", flag: "🇧🇷", phoneCode: "+55" },
  { name: "Burmese", country: "Myanmar", code: "MM", flag: "🇲🇲", phoneCode: "+95" },
  { name: "Cambodian", country: "Cambodia", code: "KH", flag: "🇰🇭", phoneCode: "+855" },
  { name: "Canadian", country: "Canada", code: "CA", flag: "🇨🇦", phoneCode: "+1" },
  { name: "Chinese", country: "China", code: "CN", flag: "🇨🇳", phoneCode: "+86" },
  { name: "Czech", country: "Czechia", code: "CZ", flag: "🇨🇿", phoneCode: "+420" },
  { name: "Danish", country: "Denmark", code: "DK", flag: "🇩🇰", phoneCode: "+45" },
  { name: "Dutch", country: "Netherlands", code: "NL", flag: "🇳🇱", phoneCode: "+31" },
  { name: "Emirati", country: "United Arab Emirates", code: "AE", flag: "🇦🇪", phoneCode: "+971" },
  { name: "Estonian", country: "Estonia", code: "EE", flag: "🇪🇪", phoneCode: "+372" },
  { name: "Filipino", country: "Philippines", code: "PH", flag: "🇵🇭", phoneCode: "+63" },
  { name: "Finnish", country: "Finland", code: "FI", flag: "🇫🇮", phoneCode: "+358" },
  { name: "French", country: "France", code: "FR", flag: "🇫🇷", phoneCode: "+33" },
  { name: "German", country: "Germany", code: "DE", flag: "🇩🇪", phoneCode: "+49" },
  { name: "Greek", country: "Greece", code: "GR", flag: "🇬🇷", phoneCode: "+30" },
  { name: "Hong Konger", country: "Hong Kong", code: "HK", flag: "🇭🇰", phoneCode: "+852" },
  { name: "Hungarian", country: "Hungary", code: "HU", flag: "🇭🇺", phoneCode: "+36" },
  { name: "Indian", country: "India", code: "IN", flag: "🇮🇳", phoneCode: "+91" },
  { name: "Indonesian", country: "Indonesia", code: "ID", flag: "🇮🇩", phoneCode: "+62" },
  { name: "Irish", country: "Ireland", code: "IE", flag: "🇮🇪", phoneCode: "+353" },
  { name: "Israeli", country: "Israel", code: "IL", flag: "🇮🇱", phoneCode: "+972" },
  { name: "Italian", country: "Italy", code: "IT", flag: "🇮🇹", phoneCode: "+39" },
  { name: "Japanese", country: "Japan", code: "JP", flag: "🇯🇵", phoneCode: "+81" },
  { name: "Kazakh", country: "Kazakhstan", code: "KZ", flag: "🇰🇿", phoneCode: "+7" },
  { name: "Korean", country: "South Korea", code: "KR", flag: "🇰🇷", phoneCode: "+82" },
  { name: "Lao", country: "Laos", code: "LA", flag: "🇱🇦", phoneCode: "+856" },
  { name: "Latvian", country: "Latvia", code: "LV", flag: "🇱🇻", phoneCode: "+371" },
  { name: "Lithuanian", country: "Lithuania", code: "LT", flag: "🇱🇹", phoneCode: "+370" },
  { name: "Malaysian", country: "Malaysia", code: "MY", flag: "🇲🇾", phoneCode: "+60" },
  { name: "Mexican", country: "Mexico", code: "MX", flag: "🇲🇽", phoneCode: "+52" },
  { name: "Nepali", country: "Nepal", code: "NP", flag: "🇳🇵", phoneCode: "+977" },
  { name: "New Zealander", country: "New Zealand", code: "NZ", flag: "🇳🇿", phoneCode: "+64" },
  { name: "Norwegian", country: "Norway", code: "NO", flag: "🇳🇴", phoneCode: "+47" },
  { name: "Pakistani", country: "Pakistan", code: "PK", flag: "🇵🇰", phoneCode: "+92" },
  { name: "Polish", country: "Poland", code: "PL", flag: "🇵🇱", phoneCode: "+48" },
  { name: "Portuguese", country: "Portugal", code: "PT", flag: "🇵🇹", phoneCode: "+351" },
  { name: "Romanian", country: "Romania", code: "RO", flag: "🇷🇴", phoneCode: "+40" },
  { name: "Russian", country: "Russia", code: "RU", flag: "🇷🇺", phoneCode: "+7" },
  { name: "Saudi", country: "Saudi Arabia", code: "SA", flag: "🇸🇦", phoneCode: "+966" },
  { name: "Singaporean", country: "Singapore", code: "SG", flag: "🇸🇬", phoneCode: "+65" },
  { name: "South African", country: "South Africa", code: "ZA", flag: "🇿🇦", phoneCode: "+27" },
  { name: "Spanish", country: "Spain", code: "ES", flag: "🇪🇸", phoneCode: "+34" },
  { name: "Sri Lankan", country: "Sri Lanka", code: "LK", flag: "🇱🇰", phoneCode: "+94" },
  { name: "Swedish", country: "Sweden", code: "SE", flag: "🇸🇪", phoneCode: "+46" },
  { name: "Swiss", country: "Switzerland", code: "CH", flag: "🇨🇭", phoneCode: "+41" },
  { name: "Taiwanese", country: "Taiwan", code: "TW", flag: "🇹🇼", phoneCode: "+886" },
  { name: "Turkish", country: "Türkiye", code: "TR", flag: "🇹🇷", phoneCode: "+90" },
  { name: "Ukrainian", country: "Ukraine", code: "UA", flag: "🇺🇦", phoneCode: "+380" },
  { name: "British", country: "United Kingdom", code: "GB", flag: "🇬🇧", phoneCode: "+44" },
  { name: "American", country: "United States", code: "US", flag: "🇺🇸", phoneCode: "+1" },
  { name: "Vietnamese", country: "Vietnam", code: "VN", flag: "🇻🇳", phoneCode: "+84" }
];

/** Every language the customer-facing pages and contracts are available in. */
export const customerLanguages = customerLocaleOptions.map((option) => ({ code: option.code, label: option.label }));

/** A flag from a two-letter country code ("FR" -> 🇫🇷). */
export function flagOf(code: string) {
  return code.toUpperCase().replace(/./g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
}

const englishRegionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

/**
 * Every country with a dialling code (Rory, 1 Nov 2026: a renter from Réunion, +262, wasn't in the short list).
 * Countries in commonCountries keep their saved nationality word ("British"); the rest use the country's name.
 */
export const allCountries: Array<{ code: string; name: string; country: string; flag: string; phoneCode: string }> = getCountries().map((code) => {
  const common = commonCountries.find((item) => item.code === code);
  const english = englishRegionNames?.of(code) || code;
  return {
    code,
    name: common?.name || english,
    country: common?.country || english,
    flag: flagOf(code),
    phoneCode: `+${getCountryCallingCode(code as CountryCode)}`
  };
});

/** Countries in alphabetical order of their name in the reader's language (Rory, 1 Nov 2026: every list like this is alphabetical). */
export function countriesSorted(locale: string) {
  let collator: Intl.Collator;
  try {
    collator = new Intl.Collator(displayNamesLocale(locale));
  } catch {
    collator = new Intl.Collator("en");
  }
  return allCountries
    .map((country) => ({ ...country, label: countryLabel(country.code, country.country, locale) }))
    .sort((a, b) => collator.compare(a.label, b.label));
}

/**
 * Read a typed or pasted phone number (Rory, 1 Nov 2026): "+262 693 47 87 99" or "00262…" finds the country by
 * itself; a number without a country code stays with the country already chosen.
 */
export function readPhone(input: string, fallbackCountry: string) {
  const cleaned = input.replace(/[^\d+]/g, "").replace(/^00/, "+");
  if (cleaned.startsWith("+")) {
    const parsed = parsePhoneNumberFromString(cleaned);
    if (parsed?.countryCallingCode) {
      const country = parsed.country || allCountries.find((item) => item.phoneCode === `+${parsed.countryCallingCode}`)?.code || fallbackCountry;
      return { country, phoneCode: `+${parsed.countryCallingCode}`, national: String(parsed.nationalNumber), detected: true, valid: parsed.isValid() };
    }
  }
  return { country: fallbackCountry, phoneCode: allCountries.find((item) => item.code === fallbackCountry)?.phoneCode || "+66", national: cleaned.replace(/^\+/, ""), detected: false, valid: false };
}

/** True when the digits are already a valid number for that country without any code. */
export function isLocalNumber(digits: string, country: string) {
  return Boolean(parsePhoneNumberFromString(digits, country as CountryCode)?.isValid());
}

export function flagForNationality(nationality?: string | null) {
  if (!nationality) {
    return "🌐";
  }

  const normalized = nationality.toLowerCase();
  return allCountries.find((country) => [country.name, country.country, country.code].some((value) => value.toLowerCase() === normalized))?.flag || "🌐";
}

/** A country's name in the reader's language ("ไทย", "สหราชอาณาจักร"), falling back to the English name kept here. */
export function countryLabel(code: string, fallback: string, locale: string) {
  try {
    const names = new Intl.DisplayNames([displayNamesLocale(locale), "en"], { type: "region" });
    return names.of(code) || fallback;
  } catch {
    return fallback;
  }
}
