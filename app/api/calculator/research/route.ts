import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/supabase/server";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { platformRates } from "@/lib/platform-rates";
import { businessPlace, languageName, researchAvailable, researchJsonSteady } from "@/lib/ai-research";

export const maxDuration = 120;

/** How long looked-up figures are reused before the market is checked again. */
const KEEP_DAYS = 30;

/**
 * Looks up, for one vehicle in the business's own area, what it rents for, how
 * often it is out, what it costs to run and what it will sell for later.
 * Replies { research, sources } - research is null when nothing could be looked
 * up, and the calculator then starts from the usual figures for that kind of vehicle.
 */
export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, any>;
  const make = String(body.make || "").slice(0, 60);
  const model = String(body.model || "").slice(0, 60);
  if (!make || !model) return NextResponse.json({ error: "Which vehicle?" }, { status: 400 });
  if (!researchAvailable()) return NextResponse.json({ research: null, sources: [] });

  const organization = await getDefaultOrganization();
  const { country, area, currency } = businessPlace(organization);
  const year = Number(body.year) || new Date().getFullYear();
  const age = Math.max(0, new Date().getFullYear() - year);
  const price = Number(body.price) || 0;
  const mileage = Number(body.mileage) || 0;
  const vehicle = [year, make, model, String(body.trim || "").slice(0, 60)].filter(Boolean).join(" ");

  // The same vehicle in the same area gives the same figures each time, so two checks can be compared fairly.
  const locale = String(body.locale || "en").slice(0, 8);
  // The figures do not depend on the reader's language, so every language shares them; only the notes are per language.
  const cacheKey = ["v7", country, area, body.category || "car", make, model, year, String(body.trim || ""), Math.round(mileage / 20000)]
    .join("|")
    .toLowerCase()
    .slice(0, 300);
  let store: any = null;
  // What other RouteHQ businesses really charge for this model replaces the web's guess at rent: it is the truer figure.
  const respond = async (research: Record<string, any>, pages: unknown[]) => {
    let platform = null;
    try {
      platform = store
        ? await platformRates(store, { make, model, country, region: String(organization.settings?.main_location?.region || ""), excludeOrganizationId: organization.id })
        : null;
    } catch {
      platform = null;
    }
    const merged = { ...research };
    if (platform?.month) Object.assign(merged, { rent_month_low: platform.month.low, rent_month_typical: platform.month.typical, rent_month_high: platform.month.high });
    if (platform?.day) Object.assign(merged, { rent_day_low: platform.day.low, rent_day_typical: platform.day.typical, rent_day_high: platform.day.high });
    return NextResponse.json({ research: merged, sources: pages, place: area, atPrice: Number(research.at_price) || price, platform });
  };
  try {
    store = createSupabaseAdminClient();
    const { data: kept } = await store.from("market_research_cache").select("payload, sources, created_at").eq("cache_key", cacheKey).maybeSingle();
    if (kept && Date.now() - new Date(kept.created_at).getTime() < KEEP_DAYS * 86400000) {
      const notes = kept.payload?.notes_by_locale?.[locale] || kept.payload?.notes_en || [];
      return respond({ ...kept.payload, notes }, kept.sources || []);
    }
  } catch {
    store = null;
  }

  const prompt = `You are a vehicle rental business analyst. A rental operator in ${area}, ${country} is thinking of buying this vehicle to rent out to customers:

- Vehicle: ${vehicle} (${String(body.category || "car")})
- Age today: ${age === 0 ? "new" : `${age} years old`}${mileage ? `, ${mileage} km on the clock` : ""}
- Price they would pay: ${price ? `${price} ${currency}` : "not decided"}

The operator is a small independent business. Its customers find it through Facebook Marketplace and local Facebook groups, walk-ins, hotel and villa partners, word of mouth and small local websites. Its competitors are other small local rental shops and private owners renting out a few vehicles - NOT international or airport brands.

Use web search to find current, real figures for ${country}, and for ${area} where they exist: what small local operators ask for this model or its direct rivals (local rental shops' own websites and price lists, Facebook Marketplace and Facebook group posts, classified sites, expat forums and local guides quoting local shop prices), used-vehicle adverts for this model at different ages (to see how its value falls), insurance and tax rules, and servicing costs. All money in ${currency}, whole numbers.

Reply with one JSON object and nothing else:
{
  "rent_month_low": number, "rent_month_typical": number, "rent_month_high": number,
  "rent_day_low": number, "rent_day_typical": number, "rent_day_high": number,
  "occupancy_long": number,
  "occupancy_short": number,
  "insurance_year": number,
  "compulsory_year": number,
  "tax_year": number,
  "maintenance_year": number,
  "maintenance_growth_pct": number,
  "buying_costs": number,
  "resale_pct_by_year": [10 numbers],
  "rent_fade_from_age": number,
  "rent_fade_pct": number,
  "max_rental_age": number,
  "market_price_low": number, "market_price_high": number,
  "notes": [up to 4 short sentences],
  "notes_en": [the same notes in English],
  "confidence": "high" | "medium" | "low"
}

What each field means:
- rent_month_*: what small local operators charge a long-stay customer for one whole month, paid monthly (their monthly rate, which is usually far less than 30 times the day rate), lowest to highest across the year, for a vehicle of this age.
- rent_day_*: what small local operators charge per day on a rental of a few days, low season to high season, for a vehicle of this age.
- Price this exact model, body style and age. Variants rent differently (a plain hatchback rents for less than its sedan, crossover or top-trim sister models, and an older car for less than a new one), so do not borrow a sister model's price without adjusting it down or up. Where prices differ by season, rent_*_low is low season, rent_*_high is high season and rent_*_typical is the average across the whole year, not the peak.
- Never use prices from Hertz, Avis, Budget, Sixt, Europcar, Enterprise, Thai Rent A Car, Chic, Drive Car Rental or other national and airport chains, or from booking aggregators (Rentalcars, Kayak, Klook, Discover Cars, Expedia): they charge far more than local operators can. Never work out a monthly rate by multiplying a day rate. If you only found chain or aggregator prices, estimate what a local shop charges (typically well below them) and lower the confidence.
- occupancy_long / occupancy_short: % of days in a year it is out on rent when rented by the month / by the day, in this area.
- insurance_year: comprehensive insurance for a vehicle used for rental, first year.
- compulsory_year: compulsory government insurance per year (0 if none). tax_year: yearly road or vehicle tax.
- maintenance_year: servicing, tyres, brakes, battery and ordinary repairs in the first year owned, at rental mileage, given its age now. maintenance_growth_pct: how much more that costs each following year.
- buying_costs: one-off costs to buy and register it (ownership transfer, registration, plates).
- resale_pct_by_year: what it would sell for after 1, 2, ... 10 years of being owned from today, as a % of the price paid today (${price ? `${price} ${currency}` : "the typical market price"}), allowing for rental mileage of about 25,000 km a year for cars and vans or 12,000 km for two-wheelers.
- rent_fade_from_age: vehicle age in years from which customers pay less for it. rent_fade_pct: how much less each year from then.
- max_rental_age: age in years after which rental customers or insurers stop accepting it.
- market_price_low / market_price_high: what this model, year and condition is advertised for in ${country} today.
- notes: written in ${languageName(String(body.locale || "en"))}, plain words, on what matters most for this model as a rental vehicle here: demand, known faults, parts, resale. Do not comment on the price they would pay.

Rules: percentages are whole numbers (85, not 0.85). Search several times: rental prices, adverts at different ages, insurance and tax. Base every figure on what you found; where you could not find it for this exact model, use the closest rival and lower the confidence. Do not flatter the vehicle. Raw JSON only, no markdown, no comments.`;

  try {
    const { data, sources } = await researchJsonSteady(prompt);
    const notesEn = Array.isArray(data.notes_en) && data.notes_en.length ? data.notes_en : data.notes || [];
    const research = { ...data, notes_en: notesEn, notes_by_locale: { [locale]: data.notes || [] }, at_price: price };
    const pages = sources.slice(0, 12);
    if (store && Number(data.rent_month_typical) > 0) {
      await store.from("market_research_cache").upsert({ cache_key: cacheKey, payload: research, sources: pages, created_at: new Date().toISOString() });
    }
    return respond(research, pages);
  } catch (error) {
    console.error("calculator research failed", error);
    return NextResponse.json({ research: null, sources: [], failed: true });
  }
}
