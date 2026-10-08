/**
 * Two price settings a business sets once in Settings, applied wherever a price
 * is worked out (the booking form and the online booking page):
 *
 *   High seasons - dates each year when prices go up by a percentage, e.g.
 *   15 Dec to 15 Jan +20%. A stay partly in season pays the increase on the
 *   share of its days that fall in it.
 *
 *   Paid extras - things a customer can add, priced per day or once per rental
 *   (child seat ฿100 a day, airport delivery ฿500).
 *
 * Stored in organizations.settings.seasons and .extras. Safe for client code.
 */

export type Season = { id: string; name: string; from: string; to: string; pct: number; monthly: boolean };
export type ExtraKind = "all" | "car" | "bike";
export type Extra = { id: string; name: string; price: number; per: "day" | "rental"; kind: ExtraKind };
export type ChosenExtra = { id: string; name: string; price: number; per: "day" | "rental"; amount: number };

const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const asObject = (value: unknown) => (value && typeof value === "object" ? (value as Record<string, any>) : {});

export function seasonsFrom(settings: unknown): Season[] {
  const list = asObject(settings).seasons;
  if (!Array.isArray(list)) return [];
  return list
    .map((raw: any, index: number) => ({
      id: String(raw?.id || `s${index}`),
      name: String(raw?.name || "").slice(0, 60),
      from: String(raw?.from || ""),
      to: String(raw?.to || ""),
      pct: Math.max(-90, Math.min(300, Math.round(Number(raw?.pct) || 0))),
      monthly: Boolean(raw?.monthly)
    }))
    .filter((season) => MMDD.test(season.from) && MMDD.test(season.to) && season.pct !== 0)
    .slice(0, 12);
}

export function extrasFrom(settings: unknown): Extra[] {
  const list = asObject(settings).extras;
  if (!Array.isArray(list)) return [];
  return list
    .map((raw: any, index: number) => ({
      id: String(raw?.id || `e${index}`),
      name: String(raw?.name || "").trim().slice(0, 60),
      price: Math.max(0, Math.round(Number(raw?.price) || 0)),
      per: raw?.per === "rental" ? ("rental" as const) : ("day" as const),
      kind: (["car", "bike"].includes(raw?.kind) ? raw.kind : "all") as ExtraKind
    }))
    .filter((extra) => extra.name && extra.price > 0)
    .slice(0, 30);
}

/** Does a calendar day (YYYY-MM-DD) fall inside a yearly season? Seasons may run over New Year. */
export function inSeason(season: Pick<Season, "from" | "to">, isoDay: string) {
  const day = isoDay.slice(5, 10);
  return season.from <= season.to ? day >= season.from && day <= season.to : day >= season.from || day <= season.to;
}

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/**
 * The rate for a stay once high seasons are counted. Each day of the stay pays
 * the biggest increase of any season it falls in; the rate goes up by the
 * average of those over the stay. A rental with no end date is judged on its
 * first month. Monthly prices only change for seasons that say so: long-stay
 * customers usually keep one price all year.
 */
export function seasonalRate(
  rate: number,
  pricingModel: string,
  seasons: Season[],
  startDate: string | null | undefined,
  endDate: string | null | undefined
): { rate: number; pct: number; names: string[]; seasonDays: number; days: number } {
  const none = { rate, pct: 0, names: [] as string[], seasonDays: 0, days: 0 };
  if (!(rate > 0) || !seasons.length || !startDate || pricingModel === "custom") return none;
  const apply = seasons.filter((season) => pricingModel !== "monthly" || season.monthly);
  if (!apply.length) return none;
  const start = startDate.slice(0, 10);
  const end = endDate ? endDate.slice(0, 10) : addDays(start, 30);
  const days = Math.max(1, Math.round((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000));
  let total = 0;
  let seasonDays = 0;
  const names = new Set<string>();
  for (let index = 0; index < Math.min(days, 366); index++) {
    const day = addDays(start, index);
    let best: Season | null = null;
    for (const season of apply) if (inSeason(season, day) && (!best || Math.abs(season.pct) > Math.abs(best.pct))) best = season;
    if (best) {
      seasonDays += 1;
      total += best.pct;
      if (best.name) names.add(best.name);
    }
  }
  const pct = total / Math.min(days, 366);
  if (!pct) return none;
  const counted = Math.min(days, 366);
  return { rate: Math.max(0, Math.round((rate * (1 + pct / 100)) / 10) * 10), pct: Math.round(pct), names: [...names], seasonDays, days: counted };
}

/** Extras offered for a kind of vehicle. */
export function extrasFor(extras: Extra[], twoWheels: boolean) {
  return extras.filter((extra) => extra.kind === "all" || (twoWheels ? extra.kind === "bike" : extra.kind === "car"));
}

/**
 * What the picked extras cost. With set dates, everything is one charge with the
 * first rent: per-day extras for every day, plus the one-off ones. With no end
 * date, per-day extras become a monthly amount added to the rent (30 days), and
 * only the one-off ones are charged up front.
 */
export function priceExtras(chosen: Extra[], days: number | null): { lines: ChosenExtra[]; upfront: number; monthly: number } {
  const lines: ChosenExtra[] = [];
  let upfront = 0;
  let monthly = 0;
  for (const extra of chosen) {
    if (extra.per === "rental") {
      lines.push({ id: extra.id, name: extra.name, price: extra.price, per: "rental", amount: extra.price });
      upfront += extra.price;
    } else if (days === null) {
      lines.push({ id: extra.id, name: extra.name, price: extra.price, per: "day", amount: extra.price * 30 });
      monthly += extra.price * 30;
    } else {
      lines.push({ id: extra.id, name: extra.name, price: extra.price, per: "day", amount: extra.price * Math.max(1, days) });
      upfront += extra.price * Math.max(1, days);
    }
  }
  return { lines, upfront, monthly };
}
