export const commonCountries = [
  { name: "Thai", country: "Thailand", code: "TH", flag: "🇹🇭", phoneCode: "+66" },
  { name: "British", country: "United Kingdom", code: "GB", flag: "🇬🇧", phoneCode: "+44" },
  { name: "German", country: "Germany", code: "DE", flag: "🇩🇪", phoneCode: "+49" },
  { name: "French", country: "France", code: "FR", flag: "🇫🇷", phoneCode: "+33" },
  { name: "Russian", country: "Russia", code: "RU", flag: "🇷🇺", phoneCode: "+7" },
  { name: "Chinese", country: "China", code: "CN", flag: "🇨🇳", phoneCode: "+86" },
  { name: "Australian", country: "Australia", code: "AU", flag: "🇦🇺", phoneCode: "+61" },
  { name: "American", country: "United States", code: "US", flag: "🇺🇸", phoneCode: "+1" },
  { name: "Swiss", country: "Switzerland", code: "CH", flag: "🇨🇭", phoneCode: "+41" },
  { name: "Dutch", country: "Netherlands", code: "NL", flag: "🇳🇱", phoneCode: "+31" },
  { name: "Swedish", country: "Sweden", code: "SE", flag: "🇸🇪", phoneCode: "+46" },
  { name: "Israeli", country: "Israel", code: "IL", flag: "🇮🇱", phoneCode: "+972" },
  { name: "Danish", country: "Denmark", code: "DK", flag: "🇩🇰", phoneCode: "+45" },
  { name: "Norwegian", country: "Norway", code: "NO", flag: "🇳🇴", phoneCode: "+47" },
  { name: "Finnish", country: "Finland", code: "FI", flag: "🇫🇮", phoneCode: "+358" }
];

export const customerLanguages = [
  { code: "en", label: "English" },
  { code: "th", label: "Thai" },
  { code: "ru", label: "Russian" },
  { code: "zh", label: "Chinese" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" }
];

export const countryCodes = ["+66", "+44", "+49", "+33", "+7", "+86", "+61", "+1", "+41", "+31", "+46", "+972", "+45", "+47", "+358"];

export function flagForNationality(nationality?: string | null) {
  if (!nationality) {
    return "🌐";
  }

  const normalized = nationality.toLowerCase();
  return commonCountries.find((country) => [country.name, country.country, country.code].some((value) => value.toLowerCase() === normalized))?.flag || "🌐";
}
