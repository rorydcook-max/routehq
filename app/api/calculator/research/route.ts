import { said } from "@/lib/i18n/server-text";
import { after, NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/supabase/server";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { platformRates } from "@/lib/platform-rates";
import { businessPlace, languageName, researchAvailable, researchJson, researchJsonSteady } from "@/lib/ai-research";
import { cleanQuotes, rateRanges } from "@/lib/rate-range";

export const maxDuration = 120;

/** How long looked-up figures are shown as they are; after that they are shown and checked again in the background. */
const KEEP_DAYS = 30;
/** How old a look-up for the same model (another year or trim) can be and still be the starting point for a quick check. */
const SEED_DAYS = 180;

/**
 * The believable local prices found, as lowest, highest and average by the day,
 * week and month. Where enough prices were found, those replace the estimate.
 */
function settle(data: Record<string, any>) {
  const quotes = cleanQuotes(data.rent_quotes);
  const rates = rateRanges(quotes);
  const out: Record<string, any> = { ...data, rent_quotes: quotes, rates };
  for (const period of ["day", "week", "month"] as const) {
    const range = rates[period];
    if (range && range.count >= 4) Object.assign(out, { [`rent_${period}_low`]: range.low, [`rent_${period}_typical`]: range.average, [`rent_${period}_high`]: range.high });
  }
  return out;
}

/** What a saved look-up is about, from its key, for the quick-check question. */
function labelFromKey(key: string) {
  const parts = key.split("|");
  const km = Number(parts[8]) * 20000;
  return `${[parts[6], parts[4], parts[5], parts[7]].filter(Boolean).join(" ")}${km ? `, about ${km} km` : ""}`;
}

/** The reply asked for, and what each figure means. Shared by the full look-up and the quick check. */
function replyShape(o: { country: string; area: string; currency: string; price: number; locale: string }) {
  return `Reply with one JSON object and nothing else:
{
  "rent_quotes": [{ "period": "day" | "week" | "month", "price": number, "where": "shop, page or group name" }],
  "rent_month_low": number, "rent_month_typical": number, "rent_month_high": number,
  "rent_week_low": number, "rent_week_typical": number, "rent_week_high": number,
  "rent_day_low": number, "rent_day_typical": number, "rent_day_high": number,
  "occupancy_long": number,
  "occupancy_short": number,
  "insurance_year": number,
  "compulsory_year": number,
  "tax_year": number,
  "maintenance_year": number,
  "maintenance_growth_pct": number,
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
- rent_quotes: every separate price you found that a small local operator or private owner in ${o.country} (in ${o.area} where possible) asks for this model or a direct rival of similar age, one entry per price, up to 20. "period" is what the price is for: one day, one week or one month. Copy the price as advertised; do not convert a day price into a week or month price. Leave out chain, airport and aggregator prices.
- rent_month_*: what small local operators charge a long-stay customer for one whole month, paid monthly (their monthly rate, which is usually far less than 30 times the day rate), lowest to highest across the year, for a vehicle of this age.
- rent_week_*: what they charge for one week.
- rent_day_*: what they charge per day on a rental of a few days, low season to high season, for a vehicle of this age.
- Price this exact model, body style and age. Variants rent differently (a plain hatchback rents for less than its sedan, crossover or top-trim sister models, and an older car for less than a new one), so do not borrow a sister model's price without adjusting it down or up. Where prices differ by season, rent_*_low is low season, rent_*_high is high season and rent_*_typical is the average across the whole year, not the peak.
- Never use prices from Hertz, Avis, Budget, Sixt, Europcar, Enterprise, Thai Rent A Car, Chic, Drive Car Rental or other national and airport chains, or from booking aggregators (Rentalcars, Kayak, Klook, Discover Cars, Expedia): they charge far more than local operators can. Never work out a weekly or monthly rate by multiplying a day rate. If you only found chain or aggregator prices, estimate what a local shop charges (typically well below them) and lower the confidence.
- occupancy_long / occupancy_short: % of days in a year it is out on rent when rented by the month / by the day, in this area.
- insurance_year: comprehensive insurance for a vehicle used for rental, first year.
- compulsory_year: compulsory government insurance per year (0 if none). tax_year: yearly road or vehicle tax.
- maintenance_year: servicing, tyres, brakes, battery and ordinary repairs in the first year owned, at rental mileage, given its age now. maintenance_growth_pct: how much more that costs each following year.
- resale_pct_by_year: what it would sell for after 1, 2, ... 10 years of being owned from today, as a % of the price paid today (${o.price ? `${o.price} ${o.currency}` : "the typical market price"}), allowing for rental mileage of about 25,000 km a year for cars and vans or 12,000 km for two-wheelers.
- rent_fade_from_age: vehicle age in years from which customers pay less for it. rent_fade_pct: how much less each year from then.
- max_rental_age: age in years after which rental customers or insurers stop accepting it.
- market_price_low / market_price_high: what this model, year and condition is advertised for in ${o.country} today.
- notes: written in ${languageName(o.locale)}, plain words, on what matters most for this model as a rental vehicle here: demand, known faults, parts, resale. Do not comment on the price they would pay.

Rules: all money in ${o.currency}, whole numbers. Percentages are whole numbers (85, not 0.85). Base every figure on what you found; where you could not find it for this exact model, use the closest rival and lower the confidence. Do not flatter the vehicle. Raw JSON only, no markdown, no comments.`;
}

/**
 * Looks up, for one vehicle in the business's own area, what it rents for, how
 * often it is out, what it costs to run and what it will sell for later.
 * Replies { research, sources, how } - research is null when nothing could be looked
 * up, and the calculator then starts from the usual figures for that kind of vehicle.
 * "how" says where the figures came from: "saved" (an earlier look-up, instant),
 * "rechecked" (an earlier look-up for the same model, checked again - quicker) or "fresh".
 */
export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: await said("Sign in first.") }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, any>;
  const make = String(body.make || "").slice(0, 60);
  const model = String(body.model || "").slice(0, 60);
  if (!make || !model) return NextResponse.json({ error: await said("Which vehicle?") }, { status: 400 });
  if (!researchAvailable()) return NextResponse.json({ research: null, sources: [] });

  const organization = await getDefaultOrganization();
  const { country, area, currency } = businessPlace(organization);
  const year = Number(body.year) || new Date().getFullYear();
  const age = Math.max(0, new Date().getFullYear() - year);
  const price = Number(body.price) || 0;
  const mileage = Number(body.mileage) || 0;
  const trim = String(body.trim || "").slice(0, 60);
  const category = String(body.category || "car");
  const vehicle = [year, make, model, trim].filter(Boolean).join(" ");
  const locale = String(body.locale || "en").slice(0, 8);
  const shape = replyShape({ country, area, currency, price, locale });

  // The same vehicle in the same area gives the same figures each time, so two checks can be compared fairly.
  // The figures do not depend on the reader's language, so every language shares them; only the notes are per language.
  const clean = (value: unknown) => String(value).replace(/[|%_]/g, " ").trim();
  const modelKey = ["v8", country, area, category, make, model].map(clean).join("|").toLowerCase();
  const cacheKey = [modelKey, year, clean(trim), Math.round(mileage / 20000)].join("|").toLowerCase().slice(0, 300);

  let store: any = null;
  try {
    store = createSupabaseAdminClient();
  } catch {
    store = null;
  }
  const keep = async (research: Record<string, any>, pages: unknown[]) => {
    if (store && Number(research.rent_month_typical) > 0) {
      await store.from("market_research_cache").upsert({ cache_key: cacheKey, payload: research, sources: pages, created_at: new Date().toISOString() });
    }
  };
  const asResearch = (data: Record<string, any>) => {
    const notesEn = Array.isArray(data.notes_en) && data.notes_en.length ? data.notes_en : data.notes || [];
    return settle({ ...data, notes_en: notesEn, notes_by_locale: { [locale]: data.notes || [] }, at_price: price });
  };

  // What other RouteHQ businesses really charge for this model replaces the web's guess at rent: it is the truer figure.
  const respond = async (research: Record<string, any>, pages: unknown[], how: "saved" | "rechecked" | "fresh", checkedAt?: string) => {
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
    return NextResponse.json({ research: merged, sources: pages, place: area, atPrice: Number(research.at_price) || price, platform, how, checkedAt: checkedAt || new Date().toISOString() });
  };

  /** A quick look: the earlier figures are checked against the live web rather than found from nothing. */
  const recheck = async (previous: Record<string, any>, previousVehicle: string) => {
    const { notes_by_locale: _notes, rates: _rates, at_price: _at, ...figures } = previous || {};
    const prompt = `You are a vehicle rental business analyst. A rental operator in ${area}, ${country} is thinking of buying this vehicle to rent out to customers:

- Vehicle: ${vehicle} (${category})
- Age today: ${age === 0 ? "new" : `${age} years old`}${mileage ? `, ${mileage} km on the clock` : ""}
- Price they would pay: ${price ? `${price} ${currency}` : "not decided"}

An earlier look-up for ${previousVehicle} in the same area found these figures:
${JSON.stringify(figures)}

Do not start over. With a few quick web searches, check whether these still hold today and for this exact vehicle: local rental prices (small local shops, Facebook Marketplace and groups, classifieds), used adverts for this model and year, insurance and running costs. Keep a figure where it still holds; change it where prices have moved or this year, trim or mileage is different. Keep the earlier rent_quotes that are still advertised and add any new ones you find.

${shape}`;
    const { data, sources } = await researchJson(prompt);
    return { research: asResearch(data), pages: sources.slice(0, 12) };
  };

  // 1. This exact vehicle was looked up before: show it straight away. When it is
  //    over a month old it is still shown, and checked again in the background.
  if (store) {
    try {
      const { data: kept } = await store.from("market_research_cache").select("payload, sources, created_at").eq("cache_key", cacheKey).maybeSingle();
      if (kept) {
        const notes = kept.payload?.notes_by_locale?.[locale] || kept.payload?.notes_en || [];
        const stale = Date.now() - new Date(kept.created_at).getTime() >= KEEP_DAYS * 86400000;
        if (stale) {
          after(async () => {
            try {
              const fresh = await recheck(kept.payload, vehicle);
              await keep(fresh.research, fresh.pages);
            } catch (error) {
              console.error("calculator background recheck failed", error);
            }
          });
        }
        return respond(settle({ ...kept.payload, notes }), kept.sources || [], "saved", kept.created_at);
      }
    } catch {
      // Carry on and look it up.
    }

    // 2. The same model was looked up for another year, trim or mileage: check those figures rather than starting over.
    try {
      const since = new Date(Date.now() - SEED_DAYS * 86400000).toISOString();
      const { data: sibling } = await store
        .from("market_research_cache")
        .select("payload, cache_key, created_at")
        // Any earlier version of the saved figures will do as a starting point ("_" matches the version digit).
        .like("cache_key", `${modelKey.replace(/^v8/, "v_")}|%`)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sibling?.payload) {
        const fresh = await recheck(sibling.payload, labelFromKey(sibling.cache_key));
        if (Number(fresh.research.rent_month_typical) > 0) {
          await keep(fresh.research, fresh.pages);
          return respond(fresh.research, fresh.pages, "rechecked");
        }
      }
    } catch (error) {
      console.error("calculator quick check failed", error);
    }
  }

  // 3. Nothing to start from: a full look-up, asked three times so one odd page does not swing it.
  const prompt = `You are a vehicle rental business analyst. A rental operator in ${area}, ${country} is thinking of buying this vehicle to rent out to customers:

- Vehicle: ${vehicle} (${category})
- Age today: ${age === 0 ? "new" : `${age} years old`}${mileage ? `, ${mileage} km on the clock` : ""}
- Price they would pay: ${price ? `${price} ${currency}` : "not decided"}

The operator is a small independent business. Its customers find it through Facebook Marketplace and local Facebook groups, walk-ins, hotel and villa partners, word of mouth and small local websites. Its competitors are other small local rental shops and private owners renting out a few vehicles - NOT international or airport brands.

Use web search to find current, real figures for ${country}, and for ${area} where they exist: what small local operators ask for this model or its direct rivals by the day, week and month (local rental shops' own websites and price lists, Facebook Marketplace and Facebook group posts, classified sites, expat forums and local guides quoting local shop prices), used-vehicle adverts for this model at different ages (to see how its value falls), insurance and tax rules, and servicing costs. Search several times and collect as many separate local rental prices as you can.

${shape}`;

  try {
    const { data, sources } = await researchJsonSteady(prompt);
    const research = asResearch(data);
    const pages = sources.slice(0, 12);
    await keep(research, pages);
    return respond(research, pages, "fresh");
  } catch (error) {
    console.error("calculator research failed", error);
    return NextResponse.json({ research: null, sources: [], failed: true });
  }
}
