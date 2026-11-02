/**
 * The short symbol for a currency code ("THB" -> "฿", "USD" -> "$"), for labels such as "Usual deposit (฿)".
 * Plain function, safe in server and client components. Falls back to the code itself.
 */
export function currencySymbol(currency: string | null | undefined): string {
  const code = String(currency || "THB").toUpperCase();
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((part) => part.type === "currency")?.value || code;
  } catch {
    return code;
  }
}
