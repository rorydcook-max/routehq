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
/**
 * Ready-made extras common in Europe (Rory, 3 Nov 2026), switched on with a price in Settings like any other extra:
 *   damage_waiver     - lowers the renter's excess to `excess` (the agreement shows the lower amount)
 *   young_driver      - for drivers under `minAge`; ticked by itself on the booking form when the driver is younger
 *   additional_driver, out_of_hours (delivery or collection), one_way
 *   cross_border      - taking the vehicle to `countries`
 */
export type ExtraPreset = "damage_waiver" | "young_driver" | "additional_driver" | "cross_border" | "out_of_hours" | "one_way";
export const EXTRA_PRESETS: ExtraPreset[] = ["additional_driver", "cross_border", "damage_waiver", "one_way", "out_of_hours", "young_driver"];
/**
 * One paid extra. `kind` is who it is offered to ("all", or the older "car"/"bike" choice); `vehicleIds`, when set,
 * narrows it to those vehicles only (Rory, 7 Nov 2026: "offered with chosen vehicles"). A price of 0 is a free extra
 * (a phone holder, say), listed on the booking like the paid ones.
 */
export type Extra = { id: string; name: string; price: number; per: "day" | "rental"; kind: ExtraKind; vehicleIds?: string[]; preset?: ExtraPreset; excess?: number; minAge?: number; countries?: string };
export type ChosenExtra = { id: string; name: string; price: number; per: "day" | "rental"; amount: number; preset?: ExtraPreset; excess?: number; minAge?: number; countries?: string };

/** The preset's own details, kept on the booking's extras lines so the agreement can use them. */
function presetDetails(raw: any): Pick<Extra, "preset" | "excess" | "minAge" | "countries"> {
  const preset = EXTRA_PRESETS.includes(raw?.preset) ? (raw.preset as ExtraPreset) : undefined;
  if (!preset) return {};
  const out: Pick<Extra, "preset" | "excess" | "minAge" | "countries"> = { preset };
  if (preset === "damage_waiver") out.excess = Math.max(0, Math.round(Number(raw?.excess) || 0));
  if (preset === "young_driver") out.minAge = Math.max(16, Math.min(30, Math.round(Number(raw?.minAge) || 25)));
  if (preset === "cross_border") out.countries = String(raw?.countries || "").trim().slice(0, 200);
  return out;
}

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
    .map((raw: any, index: number) => {
      const vehicleIds = Array.isArray(raw?.vehicleIds) ? Array.from(new Set(raw.vehicleIds.map((id: unknown) => String(id)).filter((id: string) => /^[0-9a-f-]{36}$/i.test(id)))).slice(0, 500) as string[] : [];
      return {
        id: String(raw?.id || `e${index}`),
        name: String(raw?.name || "").trim().slice(0, 60),
        // Cents and satang kept (the price field takes them); 0 is a free extra.
        price: Math.max(0, Math.round((Number(raw?.price) || 0) * 100) / 100),
        per: raw?.per === "rental" ? ("rental" as const) : ("day" as const),
        kind: (["car", "bike"].includes(raw?.kind) ? raw.kind : "all") as ExtraKind,
        ...(vehicleIds.length ? { vehicleIds } : {}),
        ...presetDetails(raw)
      };
    })
    // Before 7 Nov 2026 an extra needed a price above 0; free ones are allowed now, so only a name is required.
    .filter((extra) => extra.name)
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

/** Extras offered with a vehicle: its kind, and (when the extra names vehicles) only those vehicles. */
export function extrasFor(extras: Extra[], twoWheels: boolean, vehicleId?: string | null) {
  return extras.filter((extra) => {
    if (extra.vehicleIds?.length) return Boolean(vehicleId) && extra.vehicleIds.includes(String(vehicleId));
    return extra.kind === "all" || (twoWheels ? extra.kind === "bike" : extra.kind === "car");
  });
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
    const details = presetDetails(extra);
    if (extra.per === "rental") {
      lines.push({ id: extra.id, name: extra.name, price: extra.price, per: "rental", amount: extra.price, ...details });
      upfront += extra.price;
    } else if (days === null) {
      lines.push({ id: extra.id, name: extra.name, price: extra.price, per: "day", amount: extra.price * 30, ...details });
      monthly += extra.price * 30;
    } else {
      lines.push({ id: extra.id, name: extra.name, price: extra.price, per: "day", amount: extra.price * Math.max(1, days), ...details });
      upfront += extra.price * Math.max(1, days);
    }
  }
  return { lines, upfront, monthly };
}
