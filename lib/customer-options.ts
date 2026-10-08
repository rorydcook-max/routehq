import { supportedLocaleOptions } from "@/lib/i18n/locales";

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
export const customerLanguages = supportedLocaleOptions.map((option) => ({ code: option.code, label: option.label }));

/** Dialling codes with a flag, one entry per code, Thailand first. */
export const phoneCodeOptions = (() => {
  const seen = new Set<string>();
  const options: Array<{ code: string; label: string }> = [];
  for (const country of commonCountries) {
    if (seen.has(country.phoneCode)) continue;
    seen.add(country.phoneCode);
    const shared = commonCountries.filter((item) => item.phoneCode === country.phoneCode).map((item) => item.flag).join("");
    options.push({ code: country.phoneCode, label: `${shared} ${country.phoneCode}` });
  }
  return options;
})();

export const countryCodes = phoneCodeOptions.map((option) => option.code);

export function flagForNationality(nationality?: string | null) {
  if (!nationality) {
    return "🌐";
  }

  const normalized = nationality.toLowerCase();
  return commonCountries.find((country) => [country.name, country.country, country.code].some((value) => value.toLowerCase() === normalized))?.flag || "🌐";
}

/** A country's name in the reader's language ("ไทย", "สหราชอาณาจักร"), falling back to the English name kept here. */
export function countryLabel(code: string, fallback: string, locale: string) {
  try {
    const names = new Intl.DisplayNames([locale === "en" ? "en-GB" : locale, "en"], { type: "region" });
    return names.of(code) || fallback;
  } catch {
    return fallback;
  }
}
