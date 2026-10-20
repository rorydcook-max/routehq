/** 8400 -> "฿8,400" (or "USD 8,400"), for notes and activity text a person reads. */
export function niceMoney(value: unknown, currency: string | null | undefined = "THB"): string {
  const amount = Math.round(Number(value) || 0);
  const code = String(currency || "THB").toUpperCase();
  const number = amount.toLocaleString("en-US");
  return code === "THB" ? `฿${number}` : `${code} ${number}`;
}
