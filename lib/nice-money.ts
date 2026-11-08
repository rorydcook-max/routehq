import { businessCurrency } from "@/lib/business-units";
import { formatMoney } from "@/lib/regional";

/** 8400 -> "฿8,400" (or "£8,400", "€8,400.50"), for notes and activity text a person reads. */
export function niceMoney(value: unknown, currency: string | null | undefined = businessCurrency()): string {
  const code = String(currency || businessCurrency()).toUpperCase();
  if (code !== "THB") return formatMoney(value, code, "en-GB");
  // Exact: a refund of ฿600.25 is told as ฿600.25, not ฿600 (the booking page showed one, the message the other).
  const amount = Number(value) || 0;
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  return `฿${(whole ? Math.round(amount) : amount).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
}
