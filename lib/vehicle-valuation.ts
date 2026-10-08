import { researchJson } from "@/lib/ai-research";
import { rateRange } from "@/lib/rate-range";

/**
 * What a vehicle in the fleet would sell for today, from used adverts and sales
 * for the same make, model and year in the business's country. Prices that are
 * not believable (a "from" teaser, a wrecked car, a new one) are left out the
 * same way as rental prices. Kept for a month per make, model, year and mileage
 * band, so a fleet of ten Yarises is one look-up.
 */
export type Valuation = {
  low: number;
  typical: number;
  high: number;
  count: number;
  /** Where this vehicle sits in the range, from its condition (lib/vehicle-condition). */
  value?: number;
  checked_at: string;
  confidence?: string;
  /** "estimate" is ours; the owner's own figure is kept in estimated_value and never overwritten. */
  by: "estimate";
};

const KEEP_DAYS = 30;

export type ValuationInput = {
  category: string;
  make: string;
  model: string;
  trim?: string | null;
  year?: number | null;
  mileage?: number | null;
  country: string;
  area: string;
  currency: string;
};

function keyFor(input: ValuationInput) {
  const clean = (value: unknown) => String(value ?? "").replace(/[|%_]/g, " ").trim().toLowerCase();
  return ["val1", input.country, input.category, input.make, input.model, input.year || "", input.trim || "", Math.round(Number(input.mileage || 0) / 20000)]
    .map(clean)
    .join("|")
    .slice(0, 300);
}

/** The value now: saved within the month, or looked up. Null when nothing believable was found. */
export async function valueVehicle(store: any, input: ValuationInput): Promise<Valuation | null> {
  const cacheKey = keyFor(input);
  try {
    const { data: kept } = await store.from("market_research_cache").select("payload, created_at").eq("cache_key", cacheKey).maybeSingle();
    if (kept?.payload?.typical && Date.now() - new Date(kept.created_at).getTime() < KEEP_DAYS * 86400000) return kept.payload as Valuation;
  } catch {
    // Look it up.
  }

  const year = Number(input.year) || null;
  const vehicle = [year, input.make, input.model, input.trim].filter(Boolean).join(" ");
  const prompt = `You are valuing a used vehicle in ${input.country} for its owner, a small rental business in ${input.area}.

- Vehicle: ${vehicle} (${input.category})
- Kilometres: ${input.mileage ? `${input.mileage} km` : "not known"}

Use web search to find used adverts and recent sale prices in ${input.country} for this make and model${year ? `, from ${year - 1} to ${year + 1}` : ""}: car and motorbike classified sites, dealer stock lists, Facebook Marketplace, auction results. Collect as many separate prices as you can (up to 20), each with its year and kilometres where shown. Leave out new vehicles, wrecked or salvage vehicles, parts, rentals and "from" prices.

Reply with one JSON object and nothing else:
{
  "adverts": [{ "price": number, "year": number, "km": number, "where": "site or seller" }],
  "value_low": number, "value_typical": number, "value_high": number,
  "confidence": "high" | "medium" | "low"
}

value_*: what this vehicle, at this year and kilometres, in fair condition, would sell for today, private sale. All money in ${input.currency}, whole numbers. Raw JSON only.`;

  let data: Record<string, any>;
  try {
    data = (await researchJson(prompt)).data;
  } catch (error) {
    console.error("valuation failed", error);
    return null;
  }

  // Adverts within a year either side; the model's own range only when too few were found.
  const prices = (Array.isArray(data.adverts) ? data.adverts : [])
    .filter((advert: any) => !year || !advert?.year || Math.abs(Number(advert.year) - year) <= 1)
    .map((advert: any) => Math.round(Number(advert?.price)))
    .filter((price: number) => price > 0);
  const range = prices.length >= 3 ? rateRange(prices) : null;
  const round = (value: number) => Math.round(value / 1000) * 1000;
  const low = range ? range.low : Number(data.value_low) || 0;
  const high = range ? range.high : Number(data.value_high) || 0;
  const typical = range ? range.average : Number(data.value_typical) || (low && high ? (low + high) / 2 : 0);
  if (!(typical > 0)) return null;

  const valuation: Valuation = {
    low: round(low || typical),
    typical: round(typical),
    high: round(high || typical),
    count: range ? range.count : prices.length,
    checked_at: new Date().toISOString(),
    confidence: String(data.confidence || ""),
    by: "estimate"
  };
  try {
    await store.from("market_research_cache").upsert({ cache_key: cacheKey, payload: valuation, sources: [], created_at: valuation.checked_at });
  } catch {
    // Still use it.
  }
  return valuation;
}

/** A valuation over a month old, or none, needs looking at again. */
export function valuationStale(valuation: Valuation | null | undefined) {
  return !valuation?.checked_at || Date.now() - new Date(valuation.checked_at).getTime() >= KEEP_DAYS * 86400000;
}
