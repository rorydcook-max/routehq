import { businessCurrency } from "@/lib/business-units";
import { formatMoney } from "@/lib/regional";

/** 8400 -> "฿8,400" (or "£8,400", "€8,400.50"), for notes and activity text a person reads. */
export function niceMoney(value: unknown, currency: string | null | undefined = businessCurrency()): string {
  const code = String(currency || businessCurrency()).toUpperCase();
  if (code !== "THB") return formatMoney(value, code, "en-GB");
  const amount = Math.round(Number(value) || 0);
  return `฿${amount.toLocaleString("en-US")}`;
}
