import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import { businessCountry } from "@/lib/business-units";

/** The dialling code for a country ("PT" -> "+351"), or "" when the country is unknown. */
export function dialCodeFor(country: unknown): string {
  const code = String(country || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || !(getCountries() as string[]).includes(code)) return "";
  return `+${getCountryCallingCode(code as CountryCode)}`;
}

/** A placeholder for a phone box: the business's dialling code ("+351"), or just "+" with no country. */
export function phonePlaceholderFor(country: unknown): string {
  return dialCodeFor(country) || "+";
}

/**
 * Phone numbers as RoveHQ stores them: international, "+351912345678".
 * A number typed without a code gets the business's code (`defaultCode`, else the business's country on this
 * request); with no country known it is kept as typed rather than given a code that may be wrong.
 */
export function toInternationalPhone(value: unknown, defaultCode?: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const plus = raw.startsWith("+") || raw.startsWith("00");
  const digits = raw.replace(/\D/g, "").replace(/^00/, "");
  if (digits.length < 6) return null;
  if (plus) return `+${digits}`;
  const code = defaultCode ?? dialCodeFor(businessCountry());
  // A Thai business's customers often type 66… without the +.
  if (code === "+66" && digits.startsWith("66") && digits.length >= 11) return `+${digits}`;
  if (!code) return digits;
  return `${code}${digits.replace(/^0/, "")}`;
}

/**
 * A phone number to show people, in international format with the business's country code: "3055550142" for a
 * Miami business reads "+1 305 555 0142". Kept as given when it can't be read as a number.
 */
export function displayPhone(value: unknown, country?: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const international = toInternationalPhone(raw, dialCodeFor(country ?? businessCountry()));
  if (!international || !international.startsWith("+")) return raw;
  try {
    const parsed = parsePhoneNumberFromString(international);
    return parsed ? parsed.formatInternational() : international;
  } catch {
    return international;
  }
}

/** The same number written either way, for finding a customer: "+66812345670" and "0812345670" both give "+66812345670" and "0812345670". */
export function phoneVariants(value: unknown): string[] {
  const international = toInternationalPhone(value);
  if (!international) return [];
  const variants = new Set([international, String(value ?? "").trim()]);
  const code = dialCodeFor(businessCountry());
  if (code && international.startsWith(code)) variants.add(`0${international.slice(code.length)}`);
  if (international.startsWith("+66")) variants.add(`0${international.slice(3)}`);
  return [...variants].filter(Boolean);
}
