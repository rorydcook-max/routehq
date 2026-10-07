type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * How a price was worked out ("5 days at ฿500 a day") is written in English
 * by quoteStay and kept with the payment. This rewords one of its five shapes
 * in the reader's language (keys qx_* in the "booking" wording).
 */
export function quoteExplainIn(explain: string | null | undefined, say: Say): string {
  const text = String(explain || "");
  let m = text.match(/^(\d+) days? at (\S+) a day$/);
  if (m) return say("qx_daily", { days: Number(m[1]), rate: m[2] });
  m = text.match(/^(\d+) days? at the weekly rate of (\S+)$/);
  if (m) return say("qx_weekly", { days: Number(m[1]), rate: m[2] });
  m = text.match(/^(\d+) days? at the monthly rate of (\S+)$/);
  if (m) return say("qx_monthly", { days: Number(m[1]), rate: m[2] });
  m = text.match(/^(\d+) days?, charged as one week \((\S+)\)$/);
  if (m) return say("qx_week", { days: Number(m[1]), rate: m[2] });
  m = text.match(/^(\d+) days?, charged as one month \((\S+)\)$/);
  if (m) return say("qx_month", { days: Number(m[1]), rate: m[2] });
  return text;
}
