/**
 * Phone numbers as RouteHQ stores them: international, "+66812345670".
 * A number typed the Thai way ("081 234 5670") is Thai; one starting with + keeps its country.
 */
export function toInternationalPhone(value: unknown, defaultCode = "+66"): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const plus = raw.startsWith("+") || raw.startsWith("00");
  const digits = raw.replace(/\D/g, "").replace(/^00/, "");
  if (digits.length < 6) return null;
  if (plus) return `+${digits}`;
  if (digits.startsWith("66") && digits.length >= 11) return `+${digits}`;
  return `${defaultCode}${digits.replace(/^0/, "")}`;
}

/** The same number written either way, for finding a customer: "+66812345670" and "0812345670" both give "+66812345670" and "0812345670". */
export function phoneVariants(value: unknown): string[] {
  const international = toInternationalPhone(value);
  if (!international) return [];
  const variants = new Set([international, String(value ?? "").trim()]);
  if (international.startsWith("+66")) variants.add(`0${international.slice(3)}`);
  return [...variants].filter(Boolean);
}
